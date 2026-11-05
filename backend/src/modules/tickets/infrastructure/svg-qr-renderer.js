const QRCode = require('qrcode');

const QR_OPTIONS = Object.freeze({ type: 'svg', errorCorrectionLevel: 'M', margin: 2 });

/** Dibuja un QR real como SVG con la biblioteca qrcode 1.5.4 (MIT). */
function createSvgQrRenderer({ library = QRCode } = {}) {
  return Object.freeze({
    // qrcode completa el objeto de opciones que recibe; se entrega una copia por llamada.
    render: (payload) => library.toString(payload, { ...QR_OPTIONS }),
  });
}

module.exports = createSvgQrRenderer;
