FROM rust:1.75.0  as back

ADD . /build
WORKDIR /build

RUN cargo build --release




FROM node:18 as front

ADD ./front /build
WORKDIR /build

RUN npm i && npm run build




FROM debian:12-slim 

COPY --from=back    /build/target/release/warp-websockets-example /opt/webssh
COPY --from=front   /build/build                                  /opt/static

WORKDIR /opt

EXPOSE 8080

ENTRYPOINT /opt/webssh
