use std::borrow::Cow;
use {
    anyhow::anyhow,
    base64::DecodeError,
    log::debug,
    urlencoding::encode,
    urlencoding::decode_binary,
    base64::prelude::*,
    serde_json::json,
    serde::Deserialize,
    futures::{
        stream::SplitStream,
        StreamExt,
    },
    std::{
        env,
        sync::Arc,
        path::Path,
    },
    tokio::{
        sync::mpsc::UnboundedSender,
        net::ToSocketAddrs
    },
    russh::{
        client::Msg,
    },
    russh::*,
    warp::ws::{Message, WebSocket},
    log::{info,error},
    self::super::client_handl::ClientHandl,
    self::super::auth_type::AuthType,
    self::super::{get_ws_stdout, send_ws_msg},
};
use crate::api::ssh_websocket::get_ws_stderr;

pub struct Session {
    addr:      String,
    auth_type: AuthType,
    user:      String,
    key_name:  String,
    key_path:  String,
    key:       String,
    pwd:       String,
    container: String,
    command:   String,
    cols:      u32,
    rows:      u32,
}


#[derive(Debug, Deserialize)]
struct SSHData {
    #[serde(rename(deserialize = "type"))]
    Type: String,
    data: String
}

#[derive(Debug, Deserialize)]
struct Size {
    #[serde(rename(deserialize = "type"))]
    Type: String,
    cols: u32,
    rows: u32
}

impl Session {
    pub fn new() ->Session {
        Session {
            addr:     "127.0.0.1".to_string(),
            auth_type: AuthType::PASS,
            user:      String::new(),
            key_name:  String::new(),
            key_path:  String::new(),
            key:       String::new(),
            pwd:       String::new(),
            container: String::new(),
            command:   "bash || sh".to_string(),
            cols:      150,
            rows:      55,
        }
    }
    pub async fn connect(&mut self) -> anyhow::Result<(client::Handle<ClientHandl>, Channel<Msg>)> {
        // таймаут неактивности ssh-сессии (отключен)
        let config = client::Config {
            inactivity_timeout: /*Some(Duration::from_secs(1000005))*/ None,
            ..<_>::default()
        };

        let config = Arc::new(config);
        let cli_hndl = ClientHandl {};

        // установка соединения
        let mut cli = client::connect(config, &self.addr, cli_hndl).await?;
        let auth_res = match self.auth_type {
            AuthType::KEY_NAME => {
                let key_pair = russh_keys::load_secret_key(&self.key_path, if self.pwd.is_empty() {None} else {Some(&self.pwd)})?;
                cli.authenticate_publickey(&self.user, Arc::new(key_pair)).await?
            },
            AuthType::PASS => cli.authenticate_password(&self.user, &self.pwd).await?,
            AuthType::KEY => {
                let key_pair = russh_keys::decode_secret_key(&self.key, if self.pwd.is_empty() {None} else {Some(&self.pwd)})?;
                cli.authenticate_publickey(&self.user, Arc::new(key_pair)).await?
            },
        };

        if !auth_res {
            let err = "Authentication failed";
            return Err(anyhow!("{err}"));
        }

        // открытие канала взаимодействия с ssh-клиентом
        let channel = match cli.channel_open_session().await {
            Ok(x) => x,
            Err(e) => {
                let err = format!("(ошибка открытия канала взаимодействия с ssh-клиентом) {e}");
                return Err(anyhow!("{err}"));
            }
        };

        Ok((cli,channel))
    }

    async fn requestPty(&mut self, channel: &Channel<Msg>, cols: u32, rows: u32) -> anyhow::Result<()> {
        // запрос интерактивного PTY
        channel.request_pty(
            false,
            &env::var("TERM").unwrap_or("xterm".into()),
            cols,
            rows,
            0,
            0,
            &[], // ideally you want to pass the actual terminal modes here
        ).await?;

        Ok(())
    }

    async fn windowChange(&mut self, channel: &Channel<Msg>, cols: u32, rows: u32) -> anyhow::Result<()> {
        // запрос интерактивного PTY
        channel.window_change(
            cols,
            rows,
            0,
            0
        ).await?;

        Ok(())
    }



    pub async fn run(&mut self,
                     mut user_rx: SplitStream<WebSocket>,
                     tx: &UnboundedSender<Message>) -> anyhow::Result<u32> {

        // определение параметров соединения
        /*
        info!("Запрос соединения {}@{}:{}", username, host, port);
        debug!("Key path: {:?}\tPass: {}", private_key, password);*/



        let mut is_err = false;

        loop {
            // обработка нескольких событий
            tokio::select! {
                // получение сообщения через web-socket
                Some(result) = user_rx.next() => {
                    if let Err(e) = result {
                        error!("(парсинг msg из web-socket) Ошибка чтения сообщения: {e:?}");
                        is_err = true;
                        break;
                    }
                    // парсим сообщение из web-socket
                    let msg = result.unwrap();
                    let r_str = msg.to_str();
                    if let Err(()) = r_str {
                        error!("(парсинг msg из web-socket) Ошибка извлечения текста json (отключение)");
                        //let _ = self.close().await;
                        is_err = true;
                        break;
                    }
                    let json = r_str.unwrap();
                    let r_val = serde_json::from_str::<SSHData>(json);
                    if r_val.is_err() {
                        let r_val2 = serde_json::from_str::<Size>(json);
                        if r_val2.is_err() {
                            error!("{} or {}", r_val.err().unwrap(), r_val2.err().unwrap());
                            is_err = true;
                            break;
                        }
                        let obj = r_val2.unwrap();
                        if obj.Type == "resize" {
                            self.cols = obj.cols;
                            self.rows = obj.rows;
                            break;
                        }
                    }
                    let obj = r_val.unwrap();
                    if obj.Type == "addr"  {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                            self.addr = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                        }
                   } else if obj.Type == "login" {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                            self.user = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                        }
                    } else if obj.Type == "password" {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                            self.pwd = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                            self.auth_type = AuthType::PASS;
                        }
                    } else if obj.Type == "container"  {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                           self.container = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                        }
                    } else if obj.Type == "keysname" {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                           self.key_name = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                           self.auth_type = AuthType::KEY_NAME;
                        }
                    } else if obj.Type == "key" {
                        if let Ok(b) = BASE64_STANDARD.decode(obj.data.to_string()) {
                           self.key = std::str::from_utf8(b.as_slice()).unwrap().to_string();
                           self.auth_type = AuthType::KEY;
                        }
                    }
                },
            }
        }
        if is_err {
            return Ok(200);
        };

        let (cli, mut channel) = match self.connect().await {
            Ok(x) => x,
            Err(e) => {
                let err = format!("Ошибка создания ssh-клиент: {e}");
                error!("{err}");
                let msg = get_ws_stderr(err+"\r\n");
                send_ws_msg(&tx, msg);
                return Ok(300);
            },
        };

        // настройка соединения
        let _ = self.requestPty(&channel, self.rows, self.cols-1).await?;
        // выполнение команды
        channel.exec(true, self.command.as_str()).await?;
        let _ = self.windowChange(&channel, self.cols, self.rows-1).await;

        // код возврата
        let mut code= 0;
        // признак разрыва соединения
        let mut stdin_closed = false;

        loop {
            // обработка нескольких событий
            tokio::select! {
                // получение сообщения через web-socket
                Some(result) = user_rx.next() => {
                    if let Err(e) = result {
                        error!("(парсинг msg из web-socket) Ошибка чтения сообщения: {e:?}");
                        is_err = true;
                        break;
                    }
                    // парсим сообщение из web-socket
                    let msg = result.unwrap();
                    let r_str = msg.to_str();
                    if let Err(()) = r_str {
                        error!("(парсинг msg из web-socket) Ошибка извлечения текста json (отключение)");
                        let _ = self.close(&cli).await;
                        is_err = true;
                        break;
                    }
                    let json = r_str.unwrap();
                    let r_val = serde_json::from_str::<SSHData>(json);
                    if r_val.is_ok() {
                        let obj = r_val.unwrap();
                        if obj.Type == "stdin"  {
                            let res = BASE64_STANDARD.decode(&obj.data);
                            if let Ok(b) = res {
                                let buf: Vec<u8> = b.to_vec();
                                let n = buf.len();
                                if let Err(e) = channel.data(&buf[..n]).await {
                                    error!("Ошибка записи сообщения в канал ssh-клиента: {e:?}");
                                    break;
                                }
                            }  else {
                                let err = res.err().unwrap();
                                error!("Ошибка декодирования строки base64 из web-сокета: {err} '{}'", &obj.data);
                            }
                        } else {
                            error!("Неисзвестный тип сообщения от web-сокет: {:?}", obj);
                        }
                    } else {
                        let r_val = serde_json::from_str::<Size>(json);
                        if r_val.is_ok() {
                            let obj = r_val.unwrap();
                            let _ = self.windowChange(&channel, obj.cols, obj.rows-1).await;
                        }
                    }
                },
                // ответ сервера
                Some(msg) = channel.wait() => {
                    match msg {
                        // запись в web-socket
                        ChannelMsg::Data { ref data } => {
                            let res = std::str::from_utf8(data.iter().as_slice());
                            if let Ok(text) = res {
                                let msg = get_ws_stdout(text.to_string());
                                let _ = send_ws_msg(tx,msg);
                            } else {
                                let err = res.err().unwrap();
                                error!("Ошибка получения текста из сообщения ssh-клиента: {err:?} '{:?}'", &data);
                            }
                        }
                        // сервер закрыл соединение
                        ChannelMsg::ExitStatus { exit_status } => {
                            code = exit_status;
                            if !stdin_closed {
                                channel.eof().await?;
                                stdin_closed = true;

                                let text = format!("Завершение работы: {exit_status}");
                                let msg = get_ws_stdout(text);
                                let _ = send_ws_msg(tx, msg);
                            }
                            break;
                        }
                        _ => {
                            println!("(не обработанное сообщение от ssh-клиента): {msg:?}");
                        }
                    }
                }
            }
            if stdin_closed { break; }
        }
        Ok(code)
    }

    async fn close(&mut self, cli: &client::Handle<ClientHandl>) -> anyhow::Result<()> {
        cli.disconnect(Disconnect::ByApplication, "", "English").await?;
        Ok(())
    }
}
