import React from 'react';
import $ from 'jquery';
import toastr from 'toastr';
import bootbox from 'bootbox';
import {Terminal} from "xterm";
import Zmodem from 'zmodem.js'
const utf8_to_b64 = (rawString) => {
    return btoa(unescape(encodeURIComponent(rawString)))
}

const b64_to_utf8 = (encodeString) => {
    return decodeURIComponent(escape(atob(encodeString)))
}

const bytesHuman = (bytes, precision) => {
    if (!/^([-+])?|(\.\d+)(\d+(\.\d+)?|(\d+\.)|Infinity)$/.test(bytes)) {
        return '-'
    }
    if (bytes === 0) return '0'
    if (typeof precision === 'undefined') precision = 1
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'BB']
    const num = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = (bytes / Math.pow(1024, Math.floor(num))).toFixed(precision)

    return `${value} ${units[num]}`
}

export const readFile = (element_id, conf, setConf) => {
    const objFile = document.getElementById(element_id)
    if(objFile.value === '') {
        return
    }
    // получить файл
    const files = objFile.files
    if (files[0].size > 16 * 1024) {
        toastr.warning("Размер файла превышает 16 КБ, выберите правильный ключ.")
        objFile.value = ""
        return
    }
    //Создайте новый FileReader
    const reader = new FileReader()
    // Вернусь сюда после прочтения файла
    reader.onload = function(e) {
        // прочитать содержимое файла
        let fileString = e.target.result
        // Затем содержимое файла может быть обработано
        setConf({
            ...conf,
            keyText: fileString
        })
        //$("#" + res_id).text(fileString)
    }

    reader.onerror = function(e) {
        console.log(e)
        toastr.warning("Ошибка чтения ключа. ")
        objFile.value = ""
    }
    // прочитать файл
    reader.readAsText(files[0], "UTF-8")
}
const calc_term_size = () => {
    const width = $("#console").width() //$(window).width()
    const height = $("#console").height() //$(window).height()

    return {
        cols: Math.floor(width / 9),
        rows: Math.floor(height / 17),
    }
}

const get_connect_info = (conf)  => {
    let hostname = window.location.hostname;
    let protocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
    let ws_port = (window.location.port) ? (':' + window.location.port) : '';

    let host = conf.hostname;
    let port = conf.port;
    let user = conf.login;
    let auth = conf.type;
    let keysname       = conf.keysname;
    let container      = conf.container;
    let logsize        = conf.cnt;
    let passwd         = conf.pwd;
    let logs   = conf.utilsType === "logs";
    let stats  = conf.utilsType === "stats";
    let ssh_key        = conf.keyText;

    return {
        hostname: hostname,
        protocol: protocol,
        ws_port: ws_port,
        host: host,
        port: port,
        user: user,
        auth: auth,
        passwd: passwd,
        keysname: keysname,
        ssh_key: ssh_key,
        container: container,
        logsize: logsize,
        logs: logs,
        stats: stats
    }
}

export const ws_connect = (conf, setConf) => {
    const connect_info = get_connect_info(conf)
    const cols_rows = calc_term_size()
    const term = new Terminal({
        rendererType: 'canvas',
        cols: cols_rows.cols,
        rows: cols_rows.rows,
        useStyle: true,
        cursorBlink: true,
        theme: {
            foreground: '#7e9192',
            background: '#002833',
        }
    })
    setConf({
        ...conf,
        isShowConnect: false
    })

    term.open(document.getElementById('console'))
    term.focus()

    term.write("Настройка...\r\n")
    // Terminal.applyAddon(attach)
    // Terminal.applyAddon(fit)
    // Terminal.applyAddon(fullscreen)
    // Terminal.applyAddon(search)
    // Terminal.applyAddon(terminado)
    // Terminal.applyAddon(webLinks)
    // Terminal.applyAddon(zmodem)

    toastr.options.closeButton = false
    toastr.options.showMethod = 'slideDown'
    toastr.options.hideMethod = 'fadeOut'
    toastr.options.closeMethod = 'fadeOut'
    toastr.options.timeOut = 5000
    toastr.options.extendedTimeOut = 3000
    // toastr.options.progressBar = true
    toastr.options.positionClass = 'toast-top-right'


    let socket = new WebSocket(connect_info.protocol + connect_info.hostname + connect_info.ws_port + '/api/ssh'/*, ['webssh']*/)
    socket.binaryType = "arraybuffer";

    term.write("Регистрация функций обратного вызова...\r\n")
    const uploadFile = (zsession) => {
        let uploadHtml = (
            <div>
                <label htmlFor='fupload'>Нажмите, чтобы выбрать файл</label>
                <input id='fupload' name='fupload' type='file' multiple='true' />
                <span id='fileList'></span>
            </div>
        )

        let upload_dialog = bootbox.dialog({
            message: uploadHtml,
            title: "загрузить файлы",
            buttons: {
                cancel: {
                    label: 'закрытие',
                    className: 'btn-default',
                    callback: function (res) {
                        try {
                            // Zsession отправляет пакет ZACK каждые 5 секунд. Через 5 секунд появится сообщение о том,
                            // что последний пакет — «ZACK» и не может быть нормально закрыт. Здесь напрямую установите _last_header_name в ZRINIT,
                            // и его можно принудительно закрыть
                            zsession._last_header_name = "ZRINIT";
                            zsession.close();
                        } catch (e) {
                            console.log(e);
                        }
                    }
                },
            },
            closeButton: false,
        })

        const hideModal = () => {
            upload_dialog.modal('hide');
        }

        let file_el = document.getElementById("fupload");

        return new Promise((res) => {
            file_el.onchange = function (e) {
                let files_obj = file_el.files
                hideModal()
                let files = []
                for (let i of files_obj) {
                    if (i.size <= 2048 * 1024 * 1024) {
                        files.push(i)
                    } else {
                        toastr.warning(`${i.name} Более 2048 МБ, невозможно загрузить`)
                        // console.log(i.name, i.size, 'Более 2048 МБ, невозможно загрузить');
                    }
                }
                if (files.length === 0) {
                    try {
                        // Zsession отправляет пакет ZACK каждые 5 секунд. Через 5 секунд появится сообщение о том,
                        // что последний пакет — «ZACK» и не может быть нормально закрыт. Здесь напрямую установите _last_header_name в ZRINIT,
                        // и его можно принудительно закрыть
                        zsession._last_header_name = "ZRINIT"
                        zsession.close()
                    } catch (e) {
                        console.log(e)
                    }
                    return
                } else if (files.length >= 25) {
                    toastr.warning("Количество загружаемых файлов не может превышать 25")
                    try {
                        // Zsession отправляет пакет ZACK каждые 5 секунд. Через 5 секунд появится сообщение о том,
                        // что последний пакет — «ZACK» и не может быть нормально закрыт. Здесь напрямую установите _last_header_name в ZRINIT,
                        // и его можно принудительно закрыть
                        zsession._last_header_name = "ZRINIT"
                        zsession.close()
                    } catch (e) {
                        console.log(e)
                    }
                    return
                }
                //Zmodem.Browser.send_files(zsession, files, {
                Zmodem.Browser.send_block_files(zsession, files, {
                        on_offer_response(obj, xfer) {
                            if (xfer) {
                                term.write("\r\n")
                            } else {
                                term.write(obj.name + " загрузка прервана\r\n")
                            }
                        },
                        on_progress(obj, xfer) {
                            updateProgress(xfer)
                        },
                        on_file_complete(obj) {
                            term.write("\r\n")
                            socket.send(JSON.stringify({ type: "ignore", data: utf8_to_b64(obj.name + "(" + obj.size + ") загужено") }));
                        },
                    }
                ).then(zsession.close.bind(zsession), console.error.bind(console)
                ).then(() => {
                    res()
                })
            }
        })
    }

    const saveFile = (xfer, buffer) => {
        return Zmodem.Browser.save_to_disk(buffer, xfer.get_details().name)
    }

    const updateProgress = async (xfer, action='upload') => {
        let detail = xfer.get_details()
        let name = detail.name
        let total = detail.size
        let offset = xfer.get_offset()
        let percent =  (total === 0 || total === offset) ? 100 : Math.round(offset / total * 100)


        term.write("\r" + action + ' ' + name + ": " + bytesHuman(offset) + " " + bytesHuman(total) + " " + percent + "% ");
    }

    const downloadFile = (zsession) => {
        zsession.on("offer", function(xfer) {
            function on_form_submit() {
                if (xfer.get_details().size > 2048 * 1024 * 1024) {
                    xfer.skip()
                    toastr.warning(`${xfer.get_details().name} Больше 2048 МБ, не могу скачать`)
                    return
                }
                let FILE_BUFFER = []
                xfer.on("input", (payload) => {
                    updateProgress(xfer, "download")
                    FILE_BUFFER.push( new Uint8Array(payload) )
                })

                xfer.accept().then(
                    () => {
                        saveFile(xfer, FILE_BUFFER)
                        term.write("\r\n")
                        socket.send(JSON.stringify({ type: "ignore", data: utf8_to_b64(xfer.get_details().name + "(" + xfer.get_details().size + ") загружено") }))
                    },
                    console.error.bind(console)
                )
            }

            on_form_submit()
        })

        let promise = new Promise( (res) => {
            zsession.on("session_end", () => {
                res()
            })
        })
        zsession.start()
        return promise
    }



    $("body").attr("onbeforeunload", 'checkwindow()') //Добавить свойство запроса на закрытие обновления

    let zsentry = new Zmodem.Sentry( {
        to_terminal: function(octets) {},  //i.e. send to the terminal
        on_detect: function(detection) {
            let zsession = detection.confirm()
            let promise
            if (zsession.type === "receive") {
                promise = downloadFile(zsession)
            } else {
                promise = uploadFile(zsession)
            }
            promise.catch( console.error.bind(console) ).then( () => {
                //
            })
        },
        on_retract: function() {},
        sender: function(octets) { socket.send(new Uint8Array(octets)) },
    });

    socket.onopen = function () {
        term.write("Соединение с web-сокет установлено.\r\n")
        term.write("Установка соединения "+connect_info.user+"@"+connect_info.host + ":" + connect_info.port+"...\r\n")
        socket.send(JSON.stringify({ type: "addr", data: utf8_to_b64(connect_info.host + ":" + connect_info.port) }))
        //socket.send(JSON.stringify({ type: "term", data: utf8_to_b64("linux") }))
        socket.send(JSON.stringify({ type: "login", data: utf8_to_b64(connect_info.user) }))
        socket.send(JSON.stringify({ type: "container", data: utf8_to_b64(connect_info.container) }))
        if (connect_info.logs) {
            socket.send(JSON.stringify({ type: "logs", data: utf8_to_b64(connect_info.logs) }))
            socket.send(JSON.stringify({ type: "logsize", data: utf8_to_b64(connect_info.logsize) }))
        } else if (connect_info.stats) {
            socket.send(JSON.stringify({type: "stats", data: utf8_to_b64(connect_info.stats)}))
        }
        if (connect_info.auth === 'pwd') {
            socket.send(JSON.stringify({ type: "password", data: utf8_to_b64(connect_info.passwd) }))
        } else if (connect_info.auth === 'key') {
            if (!connect_info.passwd.isEmpty) { socket.send(JSON.stringify({ type: "password", data: utf8_to_b64(connect_info.passwd) })) }
            socket.send(JSON.stringify({ type: "key", data: utf8_to_b64(connect_info.ssh_key) }))
        } else if (connect_info.auth === 'keysname') {
            if (!connect_info.passwd.isEmpty()) { socket.send(JSON.stringify({ type: "password", data: utf8_to_b64(connect_info.passwd) })) }
            socket.send(JSON.stringify({ type: "keysname", data: utf8_to_b64(connect_info.keysname) }))
        }
        let cols_rows = calc_term_size()
        term.resize(cols_rows.cols, cols_rows.rows)
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "resize", cols: cols_rows.cols, rows: cols_rows.rows }))
        }


        // отправить данные
        // v3 xterm.js
        // term.on('data', function (data) {
        // 	socket.send(JSON.stringify({ type: "stdin", data: utf8_to_b64(data) }));
        // });

        // v4 xterm.js
        term.onData(function (data) {
            socket.send(JSON.stringify({ type: "stdin", data: utf8_to_b64(data) }))
        })
    }

    // Получить данные
    socket.onmessage = function (recv) {
        if (typeof recv.data === 'object') {
            zsentry.consume(recv.data)
        } else {
            try {
                let msg = JSON.parse(recv.data)
                switch (msg.type) {
                    case "stdout":
                    case "stderr":
                        term.write(b64_to_utf8(msg.data))
                        break
                    case "console":
                        console.log(b64_to_utf8(msg.data))
                        break
                    case "alert":
                        toastr.warning(b64_to_utf8(msg.data))
                        break
                    default:
                        console.log('Неподдерживаемый тип сообщения от сервера', msg)
                }
            } catch (e) {
                console.log('Ошибка извлечения данных сообшения', recv.data)
            }
        }
    }

    // Ошибка подключения
    socket.onerror = function (e) {
        console.log(e)
        term.write('Ошибка соединения.\r\n')
    }

    // тесная связь
    socket.onclose = function (e) {
        console.log(e)
        term.write('Соединение разорвано.\r\n')
        // term.detach();
        // term.destroy();
    }

    // Следите за окном браузера, изменяйте размер терминала в соответствии с размером окна браузера и откладывайте изменение
    let timer = 0

    $(window).resize(() => {
        clearTimeout(timer)

        timer = setTimeout(function() {
            let cols_rows = calc_term_size()
            term.resize(cols_rows.cols, cols_rows.rows)
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "resize", cols: cols_rows.cols, rows: cols_rows.rows }))
            }

        }, 100)

    })

    term.write("Установка соединения с "+connect_info.protocol + connect_info.hostname + connect_info.ws_port + '/api/ssh...\r\n')
}



export default ws_connect;