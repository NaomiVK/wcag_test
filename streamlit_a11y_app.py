import streamlit as st
import subprocess
import json
import time
from typing import Dict, Any

class StreamlitA11yIntegration:
    def __init__(self):
        self.node_script = './streamlit_a11y_checker.js'
    
    def run_accessibility_check(self, url: str) -> Dict[str, Any]:
        """Run the Node.js accessibility checker and return results"""
        try:
            # Run the Node.js script
            result = subprocess.run(
                ['node', self.node_script, url],
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return {
                    'success': False,
                    'error': f"Node.js script failed: {result.stderr}",
                    'streamlitHtml': f'<div style="padding: 20px; color: red;">Error: {result.stderr}</div>'
                }
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': "Request timed out",
                'streamlitHtml': '<div style="padding: 20px; color: red;">Request timed out after 60 seconds</div>'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'streamlitHtml': f'<div style="padding: 20px; color: red;">Error: {str(e)}</div>'
            }

def main():
    st.set_page_config(
        page_title="WCAG Accessibility Checker", 
        page_icon="🔍",
        layout="wide"
    )
    
    st.title("🔍 WCAG Accessibility Checker")
    st.markdown("Test web pages for accessibility violations with real-time highlighting")
    
    # Initialize the integration
    a11y_checker = StreamlitA11yIntegration()
    
    # Sidebar for URL input
    with st.sidebar:
        st.header("🌐 URL Input")
        
        # Predefined URLs for testing
        st.subheader("Quick Test URLs:")
        quick_urls = {
            "Canada.ca Homepage": "https://www.canada.ca",
            "Test Canada": "https://test.canada.ca",
            "GC Proto": "https://gc-proto.github.io",
        }
        
        selected_quick_url = st.selectbox(
            "Choose a quick test URL:",
            [""] + list(quick_urls.keys())
        )
        
        if selected_quick_url:
            default_url = quick_urls[selected_quick_url]
        else:
            default_url = ""
        
        # URL input
        url = st.text_input(
            "Enter URL to test:",
            value=default_url,
            placeholder="https://example.com"
        )
        
        # Test button
        if st.button("🔍 Run Accessibility Check", type="primary"):
            if url:
                st.session_state.test_url = url
                st.session_state.run_test = True
            else:
                st.error("Please enter a URL")
    
    # Main content area
    if hasattr(st.session_state, 'run_test') and st.session_state.run_test:
        test_url = st.session_state.test_url
        
        st.header(f"Testing: {test_url}")
        
        # Show loading spinner
        with st.spinner("Running accessibility check... This may take 30-60 seconds."):
            result = a11y_checker.run_accessibility_check(test_url)
        
        if result['success']:
            summary = result['summary']
            
            # Display summary metrics
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("Total Issues", summary['totalIssues'])
            with col2:
                st.metric("Errors", summary['errors'], delta=None, delta_color="inverse")
            with col3:
                st.metric("Warnings", summary['warnings'], delta=None, delta_color="inverse")
            with col4:
                st.metric("Notices", summary['notices'], delta=None, delta_color="inverse")
            
            # Display the annotated page in iframe FIRST
            st.subheader("🖼️ Page with Highlighted Violations")
            st.markdown("Hover over highlighted elements to see violation details")
            
            # Use Streamlit's HTML component to display the annotated page
            st.components.v1.html(
                result['streamlitHtml'], 
                height=800,
                scrolling=True
            )
            
            # Show detailed issues BELOW the rendered HTML
            if summary['totalIssues'] > 0:
                st.subheader("📋 Detailed Issues")
                
                # Filter options
                filter_type = st.selectbox(
                    "Filter by type:",
                    ["All", "Errors", "Warnings", "Notices"]
                )
                
                # Filter issues
                filtered_issues = summary['issues']
                if filter_type != "All":
                    filter_map = {"Errors": "error", "Warnings": "warning", "Notices": "notice"}
                    filtered_issues = [i for i in summary['issues'] if i['type'] == filter_map[filter_type]]
                
                # Display issues in an expandable format
                for i, issue in enumerate(filtered_issues):
                    severity_emoji = {"error": "🚨", "warning": "⚠️", "notice": "ℹ️"}
                    
                    with st.expander(f"{severity_emoji.get(issue['type'], '•')} {issue['type'].upper()}: {issue['message'][:100]}..."):
                        st.write(f"**Code:** `{issue['code']}`")
                        st.write(f"**Element:** `{issue['selector']}`")
                        if issue.get('context'):
                            st.write(f"**Context:** {issue['context'][:200]}...")
            
        else:
            st.error(f"Failed to check accessibility: {result['error']}")
            
            # Still show the error HTML if available
            if 'streamlitHtml' in result:
                st.components.v1.html(result['streamlitHtml'], height=200)
        
        # Reset the test flag
        st.session_state.run_test = False
    
    else:
        # Show instructions when no test is running
        st.info("👈 Enter a URL in the sidebar and click 'Run Accessibility Check' to begin")
        
        st.subheader("How it works:")
        st.markdown("""
        1. **Enter a URL** from allowed domains (canada.ca, test.canada.ca, etc.)
        2. **Click 'Run Accessibility Check'** to analyze the page
        3. **View the summary** showing total errors, warnings, and notices
        4. **Explore detailed issues** with specific violation information
        5. **See the highlighted page** with hover tooltips showing violation details
        
        The tool uses **pa11y with axe-core** for comprehensive WCAG 2.1 AA compliance checking.
        """)
        
        st.subheader("Features:")
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("""
            **🔍 Analysis:**
            - Real-time accessibility scanning
            - WCAG 2.1 AA compliance
            - Axe-core rule engine
            - Detailed violation reports
            """)
        
        with col2:
            st.markdown("""
            **🎨 Visualization:**
            - Color-coded severity levels
            - Interactive hover tooltips
            - Live page preview
            - Embedded iframe display
            """)

if __name__ == "__main__":
    main()