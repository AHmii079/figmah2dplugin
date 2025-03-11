const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();
const port = 3000;

// first build failed
// Middleware
app.use(express.json());
app.use(cors());

app.post('/scrape', async (req, res) => {
  try {
    const { url, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log(`Processing website: ${url}`);
    
    // Launch browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1440, height: 900 });
    
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get page dimensions
    const dimensions = await page.evaluate(() => {
      return {
        width: Math.min(document.documentElement.scrollWidth, 1600),
        height: Math.min(document.documentElement.scrollHeight, 3000)
      };
    });
    
    // Extract website elements
    const websiteData = await page.evaluate((opts) => {
      function getComputedStyleProperty(element, property) {
        const styles = window.getComputedStyle(element);
        return styles[property];
      }
      
      function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null;
        
        // Extract RGB values
        const rgbMatch = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!rgbMatch) return null;
        
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }
      
      function getElementData(element, rect) {
        const backgroundColor = rgbToHex(getComputedStyleProperty(element, 'backgroundColor'));
        const borderColor = rgbToHex(getComputedStyleProperty(element, 'borderColor'));
        const borderWidth = parseInt(getComputedStyleProperty(element, 'borderWidth'));
        
        return {
          type: 'container',
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: backgroundColor,
          border: borderWidth > 0,
          borderColor: borderColor,
          borderWidth: borderWidth
        };
      }
      
      // Container for all extracted data
      const data = {
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        textElements: [],
        containers: [],
        images: []
      };
      
      // Extract visible text nodes
      if (opts.importText) {
        const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, a, button, li');
        textElements.forEach(el => {
          // Skip hidden elements
          if (el.offsetParent === null) return;
          
          const rect = el.getBoundingClientRect();
          // Skip elements with zero dimensions
          if (rect.width === 0 || rect.height === 0) return;
          
          // Skip elements with no actual text
          const text = el.innerText.trim();
          if (!text) return;
          
          const computedStyle = window.getComputedStyle(el);
          const color = rgbToHex(computedStyle.color);
          
          data.textElements.push({
            type: 'text',
            content: text,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            fontSize: parseInt(computedStyle.fontSize),
            fontFamily: computedStyle.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
            fontWeight: computedStyle.fontWeight,
            color: color
          });
        });
      }
      
      // Extract containers (divs, sections, etc.)
      if (opts.importLayout) {
        const containers = document.querySelectorAll('div, section, article, header, footer, main, aside, nav');
        containers.forEach(el => {
          // Skip hidden elements
          if (el.offsetParent === null) return;
          
          const rect = el.getBoundingClientRect();
          // Skip tiny elements or those with no dimensions
          if (rect.width < 20 || rect.height < 20 || rect.width === 0 || rect.height === 0) return;
          
          // Get element data
          const elementData = getElementData(el, rect);
          elementData.name = el.id || el.className || el.tagName.toLowerCase();
          
          data.containers.push(elementData);
        });
      }
      
      // Extract images
      if (opts.importImages) {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          // Skip hidden images
          if (img.offsetParent === null) return;
          
          const rect = img.getBoundingClientRect();
          // Skip images with no dimensions
          if (rect.width === 0 || rect.height === 0) return;
          
          data.images.push({
            type: 'image',
            src: img.src,
            alt: img.alt || 'Image',
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
        });
      }
      
      return data;
    }, options);
    
    // Close browser
    await browser.close();
    
    // Send the extracted data
    res.json(websiteData);
    
  } catch (error) {
    console.error('Error scraping website:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Website scraper server running at http://localhost:${port}`);
});