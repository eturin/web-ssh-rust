mod api;

use {
    std::net::SocketAddr,
    warp::Filter,
    log::{info,error},
};

#[tokio::main]
async fn main() {
    // настройка логгирования
    env_logger::builder()
        .filter_level(log::LevelFilter::Info)
        .init();

    // прослушиваемый интерфейс
    let socket_address: SocketAddr = "0.0.0.0:8080".to_string().parse().unwrap();

    // маршруты
    let hello = api::hello::route_hello();
    let ws_ssh = api::ssh_websocket::route_ssh_websocket();
    let files = api::files::route_files();
    let res_404 = api::_404::route_404();

    let routes = ws_ssh.or(hello)
                                       .or(files)
                                       .or(res_404);

    // захват порта на сетевом интерфейсе
    let server = warp::serve(routes)
                                         .try_bind(socket_address);

    println!("Сервер  http://127.0.0.1:8080");

    // запуск web-сервера
    server.await
}

