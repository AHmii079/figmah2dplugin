figma.showUI(`<html>
  <body>
    <input type="file" id="fileInput" />
    <script>
      document.getElementById('fileInput').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          parent.postMessage({ pluginMessage: { type: 'process-h2d', content: Array.from(uint8Array) } }, '*');
        };
        reader.readAsArrayBuffer(file);
      });
    </script>
  </body>
</html>`, { width: 300, height: 200 });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'process-h2d') {
    try {
      const uint8Array = new Uint8Array(msg.content);
      const decoder = new TextDecoder("utf-8");
      const decodedContent = decoder.decode(uint8Array);
      console.log(decodedContent); // Debugging output
      
      if (isValidJson(decodedContent)) {
        const data = JSON.parse(decodedContent);
        processH2DData(data);
      } else {
        figma.notify("Unsupported H2D format");
      }
    } catch (error) {
      figma.notify('Failed to process H2D file');
    }
  }
};

function isValidJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch (e) {
    return false;
  }
}

function processH2DData(data) {
  const frame = figma.createFrame();
  frame.name = "Imported H2D Design";
  frame.resize(800, 600);
  
  if (data.elements) {
    data.elements.forEach(element => {
      const rect = figma.createRectangle();
      rect.x = element.x || 0;
      rect.y = element.y || 0;
      rect.resize(element.width || 100, element.height || 100);
      rect.fills = [{ type: 'SOLID', color: hexToRgb(element.color || '#CCCCCC') }];
      frame.appendChild(rect);
    });
  }
  
  figma.currentPage.appendChild(frame);
  figma.notify('Design imported successfully!');
}

function hexToRgb(hex) {
  let r = parseInt(hex.substring(1, 3), 16) / 255;
  let g = parseInt(hex.substring(3, 5), 16) / 255;
  let b = parseInt(hex.substring(5, 7), 16) / 255;
  return { r, g, b };
}
