mod client_handl;
mod session;
mod auth_type;


use {
    base64::prelude::*,
    serde_json::json,
    futures::{
        StreamExt,
        SinkExt,
        TryFutureExt,
    },
    tokio::sync::{mpsc,mpsc::UnboundedSender},
    tokio_stream::wrappers::UnboundedReceiverStream,
    warp::ws::{Message, WebSocket},
    log::{info,error,debug},
    auth_type::AuthType,
    session::Session,
};
use warp::{Filter, Rejection, Reply};


pub fn route_ssh_websocket() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::path!("api" / "ssh")
        .and(warp::ws())
        .map(|ws: warp::ws::Ws| ws.on_upgrade( |socket| ws_start(socket)))
}


async fn ws_start(ws: WebSocket) {

    // разделение web-сокета на два канала
    let (mut ws_tx, ws_rx) = ws.split();

    // неограниченный канал для обработки буферизации и сброса накопленных сообщений в web-сокет...
    let (tx, rx) = mpsc::unbounded_channel();
    let mut rx = UnboundedReceiverStream::new(rx);

    // отдельная асинхронная задача пересылки сообщений из неограниченного канала в web-сокет
    tokio::task::spawn(async move {
        while let Some(message) = rx.next().await {
            ws_tx.send(message)
                .unwrap_or_else(|e| { error!("websocket send error: {}", e);  })
                .await;
        }
    });




    // создание сессии для взаимодействия с ssh-клиентом
    let mut ssh = Session::new();

    if let Err(e) = ssh.run(ws_rx, &tx).await {
        error!("{e}");
        let msg = get_ws_stdout(e.to_string());
        send_ws_msg(&tx, msg);
    };


}

fn get_ws_stdout(s: String) ->Message {
    let s = BASE64_STANDARD.encode(s);
    let json = json!({"type": "stdout", "data": s});
    let text = json.to_string();
    Message::text(text)
}

fn send_ws_msg(tx: &UnboundedSender<Message> ,msg: Message) -> bool {
    if let Err(e) = tx.send(msg.clone()) {
        let err = format!("Ошибка записи в канал: {e} сообщения: {msg:?}");
        error!("{err}");
        false
    } else {
        true
    }
}