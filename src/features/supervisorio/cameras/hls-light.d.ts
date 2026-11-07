// A build leve do hls.js (sem legendas, áudio alternativo, DRM e CMCD — nada disso
// existe em câmera ao vivo) é ~40% menor, mas o export `./light` do pacote não
// publica tipos. A API é a mesma da build completa, então reaproveitamos os dela.
declare module 'hls.js/light' {
  export * from 'hls.js';
  export { default } from 'hls.js';
}
