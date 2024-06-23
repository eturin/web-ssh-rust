use warp::{Filter, Rejection, Reply};

// GET /hello/<Name> => 200 OK with body "Hello, Name!"
pub fn route_hello() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let opt = warp::path::param::<String>()
              .map(Some)
              .or_else(|_| async { Ok::<(Option<String>,), std::convert::Infallible>((None,)) });


    warp::path("hello")
        .and(opt)
        .and(warp::path::end())
        .map(|name: Option<String>| {
            format!("Hello, {}!", name.unwrap_or_else(|| "world".to_string()))
        })
}