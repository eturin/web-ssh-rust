use {
    std::{convert::Infallible, fs},
    warp::{Filter, Reply},
};

pub fn route_404() -> impl Filter<Extract = impl Reply, Error = Infallible> + Clone {
    warp::any().map(|| {
        warp::http::Response::builder()
            .status(warp::http::StatusCode::NOT_FOUND)
            .body(fs::read_to_string("./static/404.html").expect("404 404?"))
    })
}