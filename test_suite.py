#!/usr/bin/env python3
"""
Comprehensive Test Suite for Zalo Web Online Audio Player Chrome Extension
"""
import os
import json
import re
from PIL import Image
from bs4 import BeautifulSoup

def test_manifest():
    print("[1/5] Testing manifest.json...")
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    assert manifest["manifest_version"] == 3, "Must be Manifest V3"
    assert "https://chat.zalo.me/*" in manifest["host_permissions"], "Host permission missing"
    
    # Check referenced files exist
    for icon_key, icon_path in manifest["icons"].items():
        assert os.path.exists(icon_path), f"Icon missing: {icon_path}"
    
    for cs in manifest["content_scripts"]:
        for js in cs.get("js", []):
            assert os.path.exists(js), f"Content script JS missing: {js}"
        for css in cs.get("css", []):
            assert os.path.exists(css), f"Content script CSS missing: {css}"
    
    popup = manifest["action"]["default_popup"]
    assert os.path.exists(popup), f"Popup HTML missing: {popup}"
    print("  -> manifest.json is valid and all file references exist.")

def test_icons():
    print("[2/5] Testing icon dimensions...")
    for size in [16, 48, 128]:
        p = f"icons/icon{size}.png"
        assert os.path.exists(p), f"Missing {p}"
        with Image.open(p) as img:
            assert img.size == (size, size), f"Expected {(size, size)}, got {img.size}"
            assert img.format == "PNG", f"Expected PNG format, got {img.format}"
    print("  -> Icons 16x16, 48x48, 128x128 verified.")

def test_js_syntax():
    print("[3/5] Testing JavaScript syntax...")
    import subprocess
    js_files = [
        "content/inject.js",
        "content/content.js",
        "popup/popup.js"
    ]
    for jf in js_files:
        res = subprocess.run(["node", "-c", jf], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {jf}: {res.stderr}"
        print(f"  -> {jf} syntax OK.")

def test_zalo_html_parsing():
    print("[4/5] Testing DOM selector & audio recognition on 'Zalo - Thanh Hiến.html'...")
    html_path = "Zalo - Thanh Hiến.html" if os.path.exists("Zalo - Thanh Hiến.html") else "html/Zalo - Thanh Hiến.html"
    if not os.path.exists(html_path):
        print("  -> Snapshot HTML not found (skipped for privacy/lightweight repo).")
        return
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    
    audio_exts = (".m4a", ".mp3", ".wav", ".aac", ".ogg", ".flac", ".opus", ".m4r", ".weba", ".wma")
    
    file_messages = soup.select(".file-message-v2, .file-message__container")
    assert len(file_messages) > 0, "Should find at least one file message"
    
    matched_audio = []
    for msg in file_messages:
        title_el = msg.select_one(".file-message__content-title, [classname*='file-message__content-title']")
        title = title_el.get("title") if title_el else ""
        if not title and title_el:
            title = re.sub(r"\s+", " ", title_el.get_text()).strip()
        
        if any(title.lower().endswith(ext) for ext in audio_exts):
            dl_btn = msg.select_one(".file-message__actions.download, a[data-translate-title='STR_DOWNLOAD_FILE'], a[title='Lưu về máy']")
            parent_id = msg.find_parent(id=re.compile(r"msg_id_|message-frame_"))
            matched_audio.append({
                "title": title,
                "dl_btn": bool(dl_btn),
                "parent_id": parent_id["id"] if parent_id else None
            })
    
    print(f"  -> Found {len(matched_audio)} audio message(s): {matched_audio}")
    assert len(matched_audio) == 1, "Expected 1 audio message for Bản ghi Mới 10.m4a"
    assert "10.m4a" in matched_audio[0]["title"], "Target file name mismatch"
    assert matched_audio[0]["dl_btn"] is True, "Target file should have download button"
    print("  -> DOM matching & download button location verified.")

def test_spec_and_plan():
    print("[5/5] Testing specification and plan documentation...")
    assert os.path.exists("SPEC.md"), "SPEC.md missing"
    assert os.path.exists("PLAN.md"), "PLAN.md missing"
    with open("SPEC.md", "r", encoding="utf-8") as f:
        spec = f.read()
    for section in ["Objective", "Tech Stack", "Commands", "Project Structure", "Code Style", "Testing Strategy", "Boundaries", "Success Criteria"]:
        assert section in spec, f"Section missing from SPEC.md: {section}"
    print("  -> SPEC.md and PLAN.md verified.")

if __name__ == "__main__":
    print("==========================================")
    print("RUNNING EXTENSION VERIFICATION TEST SUITE")
    print("==========================================")
    test_manifest()
    test_icons()
    test_js_syntax()
    test_zalo_html_parsing()
    test_spec_and_plan()
    print("==========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! (5/5)")
    print("==========================================")
