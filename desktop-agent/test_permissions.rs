#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

fn main() {
    unsafe {
        let has_permission = CGPreflightScreenCaptureAccess();
        println!("Has permission: {}", has_permission);
        if !has_permission {
            let requested = CGRequestScreenCaptureAccess();
            println!("Requested permission: {}", requested);
        }
    }
}
