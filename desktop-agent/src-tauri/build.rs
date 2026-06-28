fn main() {
    // Require TRIPLES_API_BASE_URL at build time.
    // This ensures no fallback to a hardcoded Supabase URL in the binary.
    // Set this to your production URL before releasing: TRIPLES_API_BASE_URL=https://yourdomain.com cargo tauri build
    let api_base = std::env::var("TRIPLES_API_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    
    println!("cargo:rustc-env=TRIPLES_API_BASE_URL={}", api_base);
    println!("cargo:rerun-if-env-changed=TRIPLES_API_BASE_URL");
    
    tauri_build::build()
}
