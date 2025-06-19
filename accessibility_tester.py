import streamlit as st
import subprocess
import tempfile
import os
import re
import json

def is_valid_url(u):
    return re.match(r'^https?://', u.strip()) is not None

def run_node_axe(url, standards_list, device_type, keyboard_testing=False):
    out_file = tempfile.NamedTemporaryFile(delete=False, suffix=".html").name
    standards_str = ",".join(standards_list)
    keyboard_flag = "true" if keyboard_testing else "false"
    cmd = ["node", "a11y_audit.js", url, standards_str, device_type, out_file, keyboard_flag]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        st.error(f"Error running accessibility test: {result.stderr}")
        return "<html><body><h1>Error running test</h1></body></html>"
    
    with open(out_file, "r", encoding="utf-8") as f:
        html = f.read()
    os.unlink(out_file)
    return html

def render_html(html):
    # The HTML from Puppeteer should already be self-contained with all styles
    # Just ensure it has proper DOCTYPE and meta tags if missing
    if not html.strip().startswith('<!DOCTYPE'):
        # Add DOCTYPE if missing
        html = '<!DOCTYPE html>\n' + html
    
    # Ensure proper meta tags are present
    if '<meta charset=' not in html:
        html = html.replace('<head>', '<head>\n    <meta charset="UTF-8">')
    
    if 'viewport' not in html:
        html = html.replace('<head>', '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">')
    
    # Add CSP to allow all resources
    csp_meta = '<meta http-equiv="Content-Security-Policy" content="default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:;">'
    if 'Content-Security-Policy' not in html:
        html = html.replace('<head>', f'<head>\n    {csp_meta}')
    
    return html

# --- Streamlit UI ---
st.set_page_config(page_title="Accessibility Visual Tester", layout="wide")
st.title("WCAG Accessibility Tests")

st.markdown("""
**Features:**
- Desktop & Mobile responsive testing
- Visual highlighting of accessibility issues
- Links to WCAG documentation

**Instructions:** Enter a URL, select WCAG level, and hover over outlined elements to see accessibility issues.
""")

url = st.text_input("Enter a URL to test", "https://httpbin.org/html")

st.markdown("**Select Testing Standards (choose one or more):**")
col1, col2, col3, col4 = st.columns(4)

with col1:
    wcag2a = st.checkbox("WCAG 2.0 A", help="Web Content Accessibility Guidelines 2.0 Level A")
with col2:
    wcag2aa = st.checkbox("WCAG 2.0 AA", help="Web Content Accessibility Guidelines 2.0 Level AA")
with col3:
    best_practice = st.checkbox("Best Practice", help="Industry best practices for accessibility")
with col4:
    aria = st.checkbox("ARIA Rules", help="Accessible Rich Internet Applications guidelines")

st.markdown("**Additional Testing Options:**")
keyboard_testing = st.checkbox("⌨️ Keyboard Navigation Testing", help="Test keyboard accessibility and show tab order with numbered indicators")

# Collect selected standards
selected_standards = []
if wcag2a:
    selected_standards.append("WCAG 2.0A")
if wcag2aa:
    selected_standards.append("WCAG 2.0AA")
if best_practice:
    selected_standards.append("Best-practice")
if aria:
    selected_standards.append("Aria")

if url and not is_valid_url(url):
    st.warning("Please enter a valid URL starting with http:// or https://")

if url and is_valid_url(url):
    if not selected_standards:
        st.info("Please select at least one testing standard above to run the audit.")
    else:
        st.info(f"**Selected standards:** {', '.join(selected_standards)}")
        if st.button("Run Accessibility Audit", type="primary"):
            
            col1, col2 = st.columns(2)
            
            with col1:
                with st.spinner("Testing desktop view..."):
                    desktop_html = run_node_axe(url, selected_standards, "desktop", keyboard_testing)
            
            with col2:
                with st.spinner("Testing mobile view..."):
                    mobile_html = run_node_axe(url, selected_standards, "mobile", keyboard_testing)

            # Create tabs for better organization
            tab1, tab2 = st.tabs(["💻 Desktop View", "📱 Mobile View"])
            
            with tab1:
                st.markdown("**Desktop View** - Hover over red-outlined elements to see accessibility issues")
                st.components.v1.html(render_html(desktop_html), height=700, scrolling=True)
            
            with tab2:
                st.markdown("**Mobile View** - Hover over red-outlined elements to see accessibility issues") 
                st.components.v1.html(render_html(mobile_html), height=700, scrolling=True)
                
            st.success("✅ Accessibility audit completed! Hover over highlighted elements for detailed issue information.")
