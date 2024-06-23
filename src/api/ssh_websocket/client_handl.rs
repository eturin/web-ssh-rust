use {
    async_trait::async_trait,
    russh_keys::key,
};

pub struct ClientHandl {}

#[async_trait]
impl russh::client::Handler for ClientHandl {
    type Error = russh::Error;

    // проверка серверного ключа (отключена)
    async fn check_server_key(&mut self, _server_public_key: &key::PublicKey) -> anyhow::Result<bool, Self::Error> {
        Ok(true)
    }
}