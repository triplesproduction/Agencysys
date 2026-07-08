use std::ffi::{c_void, CStr};
use std::os::raw::c_char;

type Sel = *const c_void;
type Class = *const c_void;
type Id = *mut c_void;

#[link(name = "objc")]
#[link(name = "AppKit", kind = "framework")]
extern "C" {
    fn sel_registerName(name: *const c_char) -> Sel;
    fn objc_getClass(name: *const c_char) -> Class;
    fn objc_msgSend(obj: Id, sel: Sel) -> Id;
}

fn main() {
    unsafe {
        let cls_nsworkspace = objc_getClass(b"NSWorkspace\0".as_ptr() as *const c_char);
        println!("Class NSWorkspace: {:?}", cls_nsworkspace);
        
        let sel_sharedworkspace = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const c_char);
        let workspace: Id = objc_msgSend(cls_nsworkspace as Id, sel_sharedworkspace);
        println!("Workspace: {:?}", workspace);
        
        let sel_frontmostapplication = sel_registerName(b"frontmostApplication\0".as_ptr() as *const c_char);
        let app: Id = objc_msgSend(workspace, sel_frontmostapplication);
        println!("App: {:?}", app);
        
        let sel_localizedname = sel_registerName(b"localizedName\0".as_ptr() as *const c_char);
        let name_str: Id = objc_msgSend(app, sel_localizedname);
        println!("NameStr: {:?}", name_str);
        
        let sel_utf8string = sel_registerName(b"UTF8String\0".as_ptr() as *const c_char);
        let utf8_ptr: *const c_char = objc_msgSend(name_str, sel_utf8string) as *const c_char;
        println!("UTF8Ptr: {:?}", utf8_ptr);
        
        let c_str = CStr::from_ptr(utf8_ptr);
        println!("Frontmost App Name: {}", c_str.to_string_lossy());
    }
}
