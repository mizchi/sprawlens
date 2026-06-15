mod geometry;

pub use geometry::Point;

/// A drawable widget with a position.
pub struct Widget {
    pub origin: Point,
    pub label: String,
}

impl Widget {
    pub fn new(label: &str) -> Self {
        Widget { origin: Point::origin(), label: label.to_string() }
    }

    pub fn area(&self) -> f64 {
        0.0
    }
}

pub fn build(label: &str) -> Widget {
    Widget::new(label)
}
