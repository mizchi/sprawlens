use sample_core::{build, Widget};

fn render(w: &Widget) -> String {
    format!("{} @ ({}, {})", w.label, w.origin.x, w.origin.y)
}

fn main() {
    let w = build("hello");
    println!("{}", render(&w));
}
