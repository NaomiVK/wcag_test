const pa11y = require('pa11y');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

class StreamlitAccessibilityChecker {
  constructor() {
    this.allowedHosts = new Set([
      "cra-design.github.io",
      "cra-proto.github.io", 
      "gc-proto.github.io",
      "test.canada.ca",
      "www.canada.ca"
    ]);
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      if (!this.allowedHosts.has(urlObj.host)) {
        throw new Error(`${urlObj.host} is blocked`);
      }
      return true;
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }

  async runAccessibilityCheck(url) {
    this.validateUrl(url);
    
    try {
      const results = await pa11y(url, {
        runners: ['axe'],
        standard: 'WCAG2AA',
        includeNotices: false,
        includeWarnings: true,
        timeout: 30000,
        wait: 2000,
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      });

      return results;
    } catch (error) {
      throw error;
    }
  }

  async getPageHtml(url) {
    this.validateUrl(url);
    
    const browser = await this.initBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Fix Canada.ca relative URLs if needed
      const urlObj = new URL(url);
      if (urlObj.host === "www.canada.ca") {
        await page.evaluate(() => {
          document.querySelectorAll('img, link, script, a').forEach(elem => {
            ['src', 'href'].forEach(attr => {
              const value = elem.getAttribute(attr);
              if (value && value.startsWith('/')) {
                elem.setAttribute(attr, `https://www.canada.ca${value}`);
              }
            });
          });
        });
      }
      
      const html = await page.content();
      await context.close();
      return html;
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  // Create Streamlit-optimized HTML with violations highlighted
  createStreamlitCompatibleHtml(html, pa11yResults) {
    const $ = cheerio.load(html);
    
    // Remove any existing scripts that might interfere with Streamlit
    $('script').remove();
    
    // Make all links open in new tab to avoid navigation issues in iframe
    $('a').attr('target', '_blank');
    
    // Convert relative URLs to absolute
    $('img, link').each((_, elem) => {
      const $elem = $(elem);
      const src = $elem.attr('src') || $elem.attr('href');
      if (src && src.startsWith('/')) {
        $elem.attr('src', `https://www.canada.ca${src}`);
        $elem.attr('href', `https://www.canada.ca${src}`);
      }
    });

    // Add enhanced CSS for Streamlit iframe
    const styles = `
      <style>
        /* Reset for iframe */
        body {
          margin: 0;
          padding: 10px;
          font-family: Arial, sans-serif;
        }
        
        /* Accessibility violation highlights */
        .pa11y-violation {
          position: relative;
          outline: 3px solid #d63384 !important;
          outline-offset: 2px;
          background-color: rgba(214, 51, 132, 0.1) !important;
        }
        
        .pa11y-tooltip {
          position: absolute;
          top: -5px;
          left: 0;
          background: linear-gradient(135deg, #333, #555);
          color: white;
          padding: 12px 15px;
          border-radius: 8px;
          font-size: 13px;
          z-index: 9999;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s ease;
          max-width: 350px;
          white-space: normal;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          border-left: 4px solid #d63384;
          transform: translateY(-10px);
        }
        
        .pa11y-tooltip::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 20px;
          border: 8px solid transparent;
          border-top-color: #333;
        }
        
        .pa11y-violation:hover .pa11y-tooltip {
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Severity-based styling */
        .pa11y-error { 
          outline-color: #dc3545 !important;
          background-color: rgba(220, 53, 69, 0.2) !important;
          box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.3) !important;
        }
        .pa11y-error .pa11y-tooltip { 
          border-left-color: #dc3545; 
        }
        
        .pa11y-warning { 
          outline-color: #ff8c00 !important;
          background-color: rgba(255, 140, 0, 0.25) !important;
          box-shadow: 0 0 0 2px rgba(255, 140, 0, 0.3) !important;
        }
        .pa11y-warning .pa11y-tooltip { 
          border-left-color: #ff8c00; 
        }
        
        .pa11y-notice { 
          outline-color: #ffc107 !important;
          background-color: rgba(255, 193, 7, 0.1) !important;
        }
        .pa11y-notice .pa11y-tooltip { 
          border-left-color: #ffc107; 
        }
        
        /* Floating summary for Streamlit */
        .pa11y-streamlit-summary {
          position: fixed;
          top: 10px;
          right: 10px;
          background: linear-gradient(135deg, #2c3e50, #34495e);
          color: white;
          padding: 15px 20px;
          border-radius: 10px;
          z-index: 10000;
          max-width: 280px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 14px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .pa11y-streamlit-summary h3 {
          margin: 0 0 12px 0;
          color: #ecf0f1;
          font-size: 16px;
          border-bottom: 2px solid #3498db;
          padding-bottom: 5px;
        }
        
        .pa11y-summary-item {
          margin: 8px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .pa11y-summary-error { color: #e74c3c; font-weight: bold; }
        .pa11y-summary-warning { color: #f39c12; font-weight: bold; }
        .pa11y-summary-notice { color: #f1c40f; font-weight: bold; }
        
        .pa11y-help-text {
          margin-top: 12px;
          font-size: 11px;
          color: #bdc3c7;
          font-style: italic;
        }
        
        /* Ensure content is visible and responsive */
        img {
          max-width: 100%;
          height: auto;
        }
        
        /* Prevent horizontal scrolling in iframe */
        body {
          overflow-x: hidden;
        }
      </style>
    `;
    
    $('head').append(styles);

    // Count violations by type
    const counts = { error: 0, warning: 0, notice: 0 };
    
    // Process violations and add highlights
    pa11yResults.issues.forEach((issue) => {
      counts[issue.type]++;
      
      try {
        const $target = $(issue.selector);
        
        if ($target.length > 0) {
          // Add violation classes
          $target.addClass('pa11y-violation');
          $target.addClass(`pa11y-${issue.type}`);
          
          // Create enhanced tooltip for Streamlit
          const tooltipContent = `
            <div class="pa11y-tooltip">
              <strong>${issue.type.toUpperCase()}: ${issue.message}</strong><br><br>
              <em>Rule: ${issue.code}</em><br>
              ${issue.context ? `<small>Context: ${issue.context.substring(0, 100)}...</small><br>` : ''}
              <small>Element: ${issue.selector}</small>
            </div>
          `;
          
          // Add tooltip only if element doesn't have one already
          if (!$target.find('.pa11y-tooltip').length) {
            $target.append(tooltipContent);
          }
        }
      } catch (error) {
        // Silently skip elements that can't be annotated
      }
    });

    // Add Streamlit-optimized summary
    const summaryHtml = `
      <div class="pa11y-streamlit-summary">
        <h3>🔍 A11y Report</h3>
        <div class="pa11y-summary-item">
          <span>Errors:</span>
          <span class="pa11y-summary-error">${counts.error}</span>
        </div>
        <div class="pa11y-summary-item">
          <span>Warnings:</span>
          <span class="pa11y-summary-warning">${counts.warning}</span>
        </div>
        <div class="pa11y-summary-item">
          <span>Notices:</span>
          <span class="pa11y-summary-notice">${counts.notice}</span>
        </div>
        <div class="pa11y-help-text">
          Hover over highlighted elements for details
        </div>
      </div>
    `;
    
    $('body').append(summaryHtml);

    return $.html();
  }

  // Main method for Streamlit integration
  async processUrlForStreamlit(url) {
    try {
      // Run accessibility check
      const pa11yResults = await this.runAccessibilityCheck(url);
      
      // Get page HTML
      const html = await this.getPageHtml(url);
      
      // Create Streamlit-compatible HTML
      const streamlitHtml = this.createStreamlitCompatibleHtml(html, pa11yResults);
      
      // Create summary for Streamlit UI
      const summary = {
        url,
        totalIssues: pa11yResults.issues.length,
        errors: pa11yResults.issues.filter(i => i.type === 'error').length,
        warnings: pa11yResults.issues.filter(i => i.type === 'warning').length,
        notices: pa11yResults.issues.filter(i => i.type === 'notice').length,
        issues: pa11yResults.issues.map(issue => ({
          type: issue.type,
          message: issue.message,
          code: issue.code,
          selector: issue.selector,
          context: issue.context
        }))
      };
      
      return {
        success: true,
        url,
        summary,
        streamlitHtml, // This is what you'll pass to st.components.v1.html()
        rawResults: pa11yResults
      };
      
    } catch (error) {
      return {
        success: false,
        url,
        error: error.message,
        streamlitHtml: `<div style="padding: 20px; color: red;">Error loading page: ${error.message}</div>`
      };
    }
  }
}

// Export for use in Node.js or as a CLI tool
if (require.main === module) {
  // CLI usage example
  async function runCLI() {
    const checker = new StreamlitAccessibilityChecker();
    const url = process.argv[2];
    
    if (!url) {
      console.log('Usage: node streamlit_a11y_checker.js <url>');
      process.exit(1);
    }
    
    try {
      const result = await checker.processUrlForStreamlit(url);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      await checker.closeBrowser();
    }
  }
  
  runCLI();
}

module.exports = StreamlitAccessibilityChecker;