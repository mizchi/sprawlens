pub struct Config {
  name : String
  retries : Int
}

pub fn greet(name : String) -> String {
  "hello, " + name
}

pub fn default_config() -> Config {
  { name: "app", retries: 3 }
}
