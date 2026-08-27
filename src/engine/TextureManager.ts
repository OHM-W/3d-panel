import * as THREE from 'three';

export class TextureManager {
  private cache: Map<string, THREE.Texture> = new Map();
  private floorMaterial: THREE.MeshStandardMaterial;
  private renderer: THREE.WebGLRenderer;
  private currentUrl = '';

  constructor(floorMaterial: THREE.MeshStandardMaterial, renderer: THREE.WebGLRenderer) {
    this.floorMaterial = floorMaterial;
    this.renderer = renderer;
  }

  public updateFloorplan(url: string | undefined) {
    const cleanUrl = url?.trim() || '';
    if (this.currentUrl === cleanUrl) return;
    this.currentUrl = cleanUrl;

    if (!cleanUrl) {
      this.floorMaterial.map = null;
      this.floorMaterial.color.setHex(0x222224);
      this.floorMaterial.needsUpdate = true;
      return;
    }

    // 1. Check memory cache for instant swap (0ms)
    if (this.cache.has(cleanUrl)) {
      const tex = this.cache.get(cleanUrl)!;
      this.floorMaterial.map = tex;
      this.floorMaterial.color.setHex(0xffffff);
      this.floorMaterial.needsUpdate = true;
      return;
    }

    // 2. Off-main-thread ImageBitmap decoding
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.currentUrl !== cleanUrl) return; // Prevent race conditions
      createImageBitmap(img)
        .then((bitmap) => {
          if (this.currentUrl !== cleanUrl) return;
          const tex = new THREE.Texture(bitmap);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = false;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if (this.renderer) {
            tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          }
          tex.needsUpdate = true;

          this.cache.set(cleanUrl, tex);
          this.floorMaterial.map = tex;
          this.floorMaterial.color.setHex(0xffffff);
          this.floorMaterial.needsUpdate = true;
        })
        .catch((err) => {
          console.warn('[TextureManager] ImageBitmap failed:', err);
        });
    };
    img.onerror = (err) => {
      console.warn('[TextureManager] Failed to load floorplan URL:', cleanUrl, err);
    };
    img.src = cleanUrl;
  }

  public restoreContext() {
    if (this.floorMaterial.map) {
      this.floorMaterial.map.needsUpdate = true;
    }
    for (const [, tex] of this.cache.entries()) {
      tex.needsUpdate = true;
    }
    this.floorMaterial.needsUpdate = true;
  }

  public dispose() {
    for (const [, tex] of this.cache.entries()) {
      tex.dispose();
    }
    this.cache.clear();
    if (this.floorMaterial.map) {
      this.floorMaterial.map.dispose();
      this.floorMaterial.map = null;
    }
  }
}
