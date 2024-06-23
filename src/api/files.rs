use warp::{Filter, Rejection, Reply};

pub fn route_files() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    warp::fs::dir("./static")
}