export const HEISER_SVG = String.raw`<svg id="heiser-svg" viewBox="0 0 320 380" class="stage-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Gradasi Tudung Maroon Cerah (#7F1B2A) -->
              <linearGradient id="maroonHoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#952334" />
                <stop offset="52%" stop-color="#7F1B2A" />
                <stop offset="100%" stop-color="#68141F" />
              </linearGradient>

              <!-- Gradasi Cheek Fin Maroon/Merah -->
              <linearGradient id="cheekFinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#9C1B2C" />
                <stop offset="100%" stop-color="#71131F" />
              </linearGradient>

              <!-- Dasar Badan Putih Bersih + Shading Halus Bawah -->
              <linearGradient id="whiteBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#FFFFFF" />
                <stop offset="80%" stop-color="#FFFFFF" />
                <stop offset="93%" stop-color="#F2F5F9" />
                <stop offset="100%" stop-color="#E2E8F0" />
              </linearGradient>

              <!-- Gradasi Kaca Lensa Metalik (#787D87 -> #A3A8B3 -> #525660) -->
              <linearGradient id="headlampGlassGrad" x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stop-color="#787D87" />
                <stop offset="46%" stop-color="#A3A8B3" />
                <stop offset="100%" stop-color="#525660" />
              </linearGradient>

              <!-- Gradasi Soft LED Glow & Shimmer -->
              <radialGradient id="ledSoftGlowGrad" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stop-color="#FFF1F2" stop-opacity="0.95" />
                <stop offset="55%" stop-color="#FDA4AF" stop-opacity="0.45" />
                <stop offset="100%" stop-color="#C81D2E" stop-opacity="0" />
              </radialGradient>

              <linearGradient id="ledShimmerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(255,255,255,0)" />
                <stop offset="50%" stop-color="rgba(255,255,255,0.82)" />
                <stop offset="100%" stop-color="rgba(255,255,255,0)" />
              </linearGradient>

              <!-- Gradasi Sepatu Merah -->
              <linearGradient id="shoeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#D81B35" />
                <stop offset="100%" stop-color="#980F22" />
              </linearGradient>

              <!-- Gradasi Rongga Mulut -->
              <linearGradient id="mouthCavityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#4A0D16" />
                <stop offset="100%" stop-color="#741625" />
              </linearGradient>

              <!-- CLIP PATH SILUET BADAN KAPSUL WHOOSH (CENTER X=160) -->
              <clipPath id="heiserBodyClip">
                <path d="M 160 26 C 90 26, 56 88, 57 168 C 58 238, 88 276, 160 276 C 232 276, 262 238, 263 168 C 264 88, 230 26, 160 26 Z" />
              </clipPath>

              <!-- CLIP PATH LENSA ATAS & BAWAH (KIRI) -->
              <clipPath id="upperLensClip">
                <path d="M 73.2 103.5 C 67.8 114, 64.4 125.5, 63.6 135.2 L 79.8 140.2 C 79.6 127.5, 77.6 114.5, 74.2 104 C 73.9 103.2, 73.5 103.1, 73.2 103.5 Z" />
              </clipPath>
              <clipPath id="lowerLensClip">
                <path d="M 63.6 141.6 L 80.1 146.6 C 80.3 159.5, 79.5 171.8, 76.2 179.4 C 73.8 183.8, 68.5 183.2, 65.8 177.2 C 63.6 167.5, 63.1 154.5, 63.6 141.6 Z" />
              </clipPath>

              <!-- SLEEK FLUSH CURVED HEADLAMP CLUSTER + CHEEK FIN (#headlampLeft, MIRRORED TO RIGHT) -->
              <g id="headlampLeft">
                <!-- 1. Outer Housing: Tapered Curved Almond/Crescent Bezel sejajar kontur badan -->
                <path d="M 74.2 96.2 C 64.8 112.5, 59.8 141.5, 60.8 171.8 C 61.4 182.2, 66.2 188.8, 72.2 189.2 C 78.6 189.5, 83.4 180.5, 83.8 165.5 C 84.4 143.5, 81.8 117.5, 76.8 98.8 C 76.1 95.8, 75.0 95.2, 74.2 96.2 Z"
                      fill="#3E4149" stroke="#4A151B" stroke-width="2.5" stroke-linejoin="round" />

                <!-- 2. Upper Recessed Glossy Lens (Slim Curved Teardrop/Triangle) -->
                <g>
                  <path d="M 73.2 103.5 C 67.8 114, 64.4 125.5, 63.6 135.2 L 79.8 140.2 C 79.6 127.5, 77.6 114.5, 74.2 104 C 73.9 103.2, 73.5 103.1, 73.2 103.5 Z"
                        fill="url(#headlampGlassGrad)" />
                  <g clip-path="url(#upperLensClip)">
                    <!-- Soft LED Glow saat bicara/berpikir -->
                    <ellipse class="headlamp-led-glow" cx="72" cy="123" rx="12" ry="18" fill="url(#ledSoftGlowGrad)" />
                    <!-- Specular Reflection Streak Diagonal -->
                    <path d="M 61 118 L 81 106 L 84 111 L 62 124 Z" fill="#FFFFFF" opacity="0.45" />
                    <path d="M 63 131 L 82 121 L 83 123.5 L 64 134 Z" fill="#FFFFFF" opacity="0.22" />
                    <rect class="headlamp-led-shimmer" x="59" y="116" width="26" height="12" rx="6" fill="url(#ledShimmerGrad)" />
                  </g>
                </g>

                <!-- 3. Lower Recessed Glossy Lens (Slim Curved Rounded-Trapezoid) -->
                <g>
                  <path d="M 63.6 141.6 L 80.1 146.6 C 80.3 159.5, 79.5 171.8, 76.2 179.4 C 73.8 183.8, 68.5 183.2, 65.8 177.2 C 63.6 167.5, 63.1 154.5, 63.6 141.6 Z"
                        fill="url(#headlampGlassGrad)" />
                  <g clip-path="url(#lowerLensClip)">
                    <!-- Soft LED Glow saat bicara/berpikir -->
                    <ellipse class="headlamp-led-glow" cx="72" cy="164" rx="12" ry="20" fill="url(#ledSoftGlowGrad)" />
                    <!-- Specular Reflection Streak Diagonal -->
                    <path d="M 60 158 L 83 145 L 86 150.5 L 61 164.5 Z" fill="#FFFFFF" opacity="0.45" />
                    <path d="M 63 174 L 83 163 L 84 165.5 L 64 176.5 Z" fill="#FFFFFF" opacity="0.22" />
                    <rect class="headlamp-led-shimmer" x="59" y="156" width="26" height="12" rx="6" fill="url(#ledShimmerGrad)" />
                  </g>
                </g>

                <!-- 4. Lower Cheek Accent Fin (Mengalir halus ke pita merah perut) -->
                <path d="M 52 192 C 65 196, 77 206, 86 222 C 88 226, 86 230, 81 232 C 71 235, 60 233, 52 226 Z"
                      fill="url(#cheekFinGrad)" />
                <path d="M 54 193 C 66 197, 77 207, 85 221"
                      fill="none" stroke="#C81D2E" stroke-width="2.2" stroke-linecap="round" />
              </g>
                      <!-- TANGAN TERARTIKULASI: palm + 4 jari + ibu jari per pose -->
          <g id="hand-pose-relaxed" transform="scale(1.8)">
            <path d="M -10.8 9.2 L -11.6 9.4 L -12.4 9.5 L -13.2 9.7 L -13.9 9.8 L -14.7 10.0 L -15.5 10.1 L -16.2 10.3 L -17.0 10.5 L -17.7 10.7 L -18.4 11.0 L -19.2 11.2 L -19.9 11.5 A 2.1 2.1 0 0 1 -21.4 7.6 L -20.6 7.3 L -19.8 7.0 L -19.0 6.7 L -18.1 6.4 L -17.3 6.2 L -16.5 5.9 L -15.7 5.7 Q -14.8 5.4 -16.3 5.2 L -17.3 5.3 L -18.3 5.4 L -19.2 5.5 L -20.2 5.6 L -21.1 5.8 L -22.0 6.0 L -22.9 6.2 A 2.3 2.3 0 0 1 -24.0 1.8 L -23.0 1.5 L -22.0 1.2 L -20.9 1.0 L -19.9 0.8 L -18.9 0.7 L -17.8 0.5 L -16.8 0.4 Q -15.7 0.1 -17.1 -0.2 L -18.1 -0.2 L -19.1 -0.3 L -20.2 -0.3 L -21.2 -0.3 L -22.2 -0.2 L -23.2 -0.2 L -24.2 -0.1 A 2.3 2.3 0 0 1 -24.7 -4.7 L -23.6 -4.9 L -22.5 -5.0 L -21.3 -5.0 L -20.2 -5.1 L -19.1 -5.1 L -18.0 -5.1 L -16.9 -5.1 Q -15.5 -5.3 -16.6 -5.5 L -17.5 -5.6 L -18.5 -5.7 L -19.4 -5.9 L -20.3 -5.9 L -21.2 -6.0 L -22.2 -6.0 L -23.1 -6.0 A 2.3 2.3 0 0 1 -23.1 -10.6 L -22.1 -10.7 L -21.0 -10.7 L -20.0 -10.6 L -18.9 -10.6 L -17.9 -10.5 L -16.9 -10.4 L -15.9 -10.3 L -14.9 -10.1 L -13.9 -10.0 L -12.9 -9.8 L -11.9 -9.6 L -10.9 -9.5 Q -9.9 -10.4 -8.8 -9.9 Q -12.0 -10.7 -12.6 -13.4 A 2.90 2.90 0 0 1 -7.8 -16.6 Q -5.5 -13.7 -4.6 -9.8 C -2.2 -9.0, 0.4 -7.2, 3.0 -5.0 C 3.8 -1.9, 3.8 1.9, 3.0 5.0 C -4.6 9.9, -9.2 9.8, -10.4 9.4 Z" fill="#FFFFFF" stroke="#4A151B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <g id="hand-pose-open" transform="scale(1.8)">
            <path d="M -10.8 9.2 L -11.6 9.4 L -12.4 9.5 L -13.2 9.7 L -13.9 9.8 L -14.7 10.0 L -15.5 10.1 L -16.2 10.3 L -17.0 10.5 L -17.7 10.7 L -18.4 11.0 L -19.2 11.2 L -20.5 11.2 A 2.1 2.1 0 0 1 -22.1 8.3 L -21.2 7.9 L -19.8 7.0 L -19.0 6.7 L -18.1 6.4 L -17.3 6.2 L -16.5 5.9 L -15.7 5.7 Q -14.8 5.4 -16.3 5.2 L -17.3 5.3 L -18.3 5.4 L -19.2 5.5 L -20.2 5.6 L -21.1 5.8 L -22.0 6.0 L -23.4 6.3 A 2.3 2.3 0 0 1 -24.9 2.3 L -23.9 2.0 L -22.0 1.2 L -20.9 1.0 L -19.9 0.8 L -18.9 0.7 L -17.8 0.5 L -16.8 0.4 Q -15.7 0.1 -17.1 -0.2 L -18.1 -0.2 L -19.1 -0.3 L -20.2 -0.3 L -21.2 -0.3 L -22.2 -0.2 L -23.2 -0.2 L -24.6 -0.2 A 2.3 2.3 0 0 1 -25.6 -4.4 L -24.5 -4.6 L -22.5 -5.0 L -21.3 -5.0 L -20.2 -5.1 L -19.1 -5.1 L -18.0 -5.1 L -16.9 -5.1 Q -15.5 -5.3 -16.6 -5.5 L -17.5 -5.6 L -18.5 -5.7 L -19.4 -5.9 L -20.3 -5.9 L -21.2 -6.0 L -22.2 -6.0 L -23.5 -6.1 A 2.3 2.3 0 0 1 -23.9 -11.3 L -22.9 -11.4 L -21.0 -10.7 L -20.0 -10.6 L -18.9 -10.6 L -17.9 -10.5 L -16.9 -10.4 L -15.9 -10.3 L -14.9 -10.1 L -13.9 -10.0 L -12.9 -9.8 L -11.9 -9.6 L -10.9 -9.5 Q -9.9 -10.4 -8.8 -9.9 Q -12.0 -10.7 -12.6 -13.4 A 2.90 2.90 0 0 1 -7.8 -16.6 Q -5.5 -13.7 -4.6 -9.8 C -2.2 -9.0, 0.4 -7.2, 3.0 -5.0 C 3.8 -1.9, 3.8 1.9, 3.0 5.0 C -4.6 9.9, -9.2 9.8, -10.4 9.4 Z" fill="#FFFFFF" stroke="#4A151B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <g id="hand-pose-chest" transform="scale(1.8)">
            <path d="M -10.8 9.2 L -11.6 9.4 L -12.3 9.5 L -13.1 9.6 L -13.8 9.7 L -14.5 9.9 L -15.2 10.1 L -15.8 10.3 L -16.5 10.5 L -17.1 10.8 L -17.6 11.1 L -18.2 11.4 L -18.7 11.8 A 2.1 2.1 0 0 1 -21.2 8.5 L -20.4 8.0 L -19.7 7.4 L -18.9 7.0 L -18.0 6.6 L -17.2 6.2 L -16.4 5.9 L -15.6 5.7 Q -14.6 5.4 -15.9 5.2 L -16.8 5.3 L -17.6 5.5 L -18.4 5.7 L -19.2 5.9 L -20.0 6.2 L -20.7 6.5 L -21.4 6.9 A 2.3 2.3 0 0 1 -23.6 2.9 L -22.6 2.4 L -21.7 1.9 L -20.7 1.5 L -19.7 1.1 L -18.6 0.8 L -17.6 0.6 L -16.6 0.4 Q -15.4 0.2 -16.6 0.0 L -17.5 0.0 L -18.4 0.1 L -19.3 0.2 L -20.2 0.4 L -21.1 0.5 L -21.9 0.8 L -22.7 1.1 A 2.3 2.3 0 0 1 -24.4 -3.3 L -23.3 -3.7 L -22.2 -4.1 L -21.1 -4.3 L -20.0 -4.6 L -18.9 -4.7 L -17.8 -4.8 L -16.7 -4.9 Q -15.2 -5.0 -16.2 -5.1 L -17.0 -5.2 L -17.8 -5.2 L -18.7 -5.2 L -19.5 -5.1 L -20.2 -5.0 L -21.0 -4.9 L -21.7 -4.7 A 2.3 2.3 0 0 1 -23.1 -9.1 L -22.0 -9.4 L -21.0 -9.6 L -19.9 -9.8 L -18.9 -9.9 L -17.8 -10.0 L -16.8 -10.0 L -15.8 -10.0 L -14.8 -9.9 L -13.8 -9.8 L -12.9 -9.7 L -11.9 -9.6 L -11.0 -9.5 Q -9.9 -10.4 -8.8 -9.9 Q -11.6 -10.8 -11.5 -13.1 A 2.85 2.85 0 0 1 -6.5 -15.7 Q -4.7 -13.1 -4.6 -9.8 C -2.2 -9.0, 0.4 -7.2, 3.0 -5.0 C 3.8 -1.9, 3.8 1.9, 3.0 5.0 C -4.6 9.9, -9.2 9.8, -10.4 9.4 Z" fill="#FFFFFF" stroke="#4A151B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <g id="hand-pose-thinking" transform="scale(2.2)">
            <path d="M 6.4 -3.6 C 5.6 -5.6, 3.6 -6.4, 1.4 -6.8 C 0.0 -7.2, -1.4 -7.8, -2.4 -8.4 C -1.8 -10.0, -2.2 -12.4, -3.6 -14.1 A 2.7 2.7 0 0 0 -8.1 -13.8 C -8.9 -12.6, -9.3 -10.6, -9.4 -8.6 C -9.6 -8.5, -9.9 -8.4, -10.2 -8.4 C -13.6 -9.2, -17.0 -9.8, -20.6 -10.3 C -23.8 -10.8, -26.4 -10.5, -27.6 -9.6 C -28.5 -8.9, -28.3 -7.4, -27.2 -6.9 C -25.0 -6.0, -21.2 -6.2, -18.0 -6.2 C -16.0 -6.2, -14.5 -5.9, -13.2 -5.2 C -14.4 -4.0, -15.4 -2.6, -15.1 -1.2 C -14.9 0.2, -14.0 0.4, -13.8 1.4 C -14.6 2.6, -15.2 3.4, -14.9 4.6 C -14.6 5.8, -13.8 5.6, -13.7 6.4 C -14.5 7.4, -14.8 8.4, -14.2 9.2 C -12.4 10.9, -8.0 11.8, -4.0 11.4 C -1.0 11.1, 2.0 10.4, 3.6 9.2 C 5.4 7.9, 6.6 5.6, 6.9 3.2 C 7.1 1.0, 7.0 -1.8, 6.4 -3.6 Z" fill="#FFFFFF" stroke="#4A151B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </g>
          <g id="hand-pose-aha" transform="scale(1.8)">
            <path d="M 3.0 -5.0 C 0.4 -7.2, -2.2 -9.0, -4.6 -9.8 Q -5.3 -12.0, -6.8 -13.2 A 2.20 2.20 0 0 0 -9.9 -11.5 Q -10.1 -10.4, -8.8 -9.9 Q -9.7 -10.2, -10.4 -9.6 C -13.0 -10.0, -15.6 -10.3, -18.2 -10.4 C -21.0 -10.5, -23.6 -10.4, -25.6 -10.2 C -27.4 -10.0, -28.6 -9.4, -28.9 -8.4 C -29.2 -7.3, -28.6 -6.4, -27.5 -6.3 C -25.7 -6.0, -23.4 -6.2, -21.1 -6.3 C -18.9 -6.4, -16.6 -6.3, -15.4 -6.0 C -14.5 -5.9, -13.9 -5.5, -13.5 -4.9 C -14.3 -4.7, -14.8 -4.3, -14.5 -3.9 C -14.2 -3.5, -13.6 -3.2, -12.9 -3.1 C -11.8 -2.3, -10.6 -2.4, -9.9 -3.3 C -9.4 -4.1, -8.9 -4.2, -8.6 -3.6 C -8.2 -3.2, -9.8 -3.1, -10.5 -2.0 C -11.5 -0.8, -11.4 0.5, -10.4 1.3 C -9.8 1.7, -9.8 2.0, -10.2 2.4 C -11.1 3.2, -11.1 4.6, -10.2 5.4 C -9.7 5.8, -9.7 6.1, -10.1 6.5 C -10.9 7.3, -10.8 8.2, -10.0 8.8 C -8.2 9.9, -4.6 9.5, -2.8 8.7 C -0.8 7.8, 1.2 6.6, 3.0 5.0 Z" fill="#FFFFFF" stroke="#4A151B" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </g>
            </defs>

            <!-- BAYANGAN LANTAI (ikut bereaksi saat melompat/bernapas) -->
            <ellipse id="rig-shadow" cx="160" cy="360" rx="68" ry="10" fill="#94A3B8" opacity="0.34" />

            <!-- KAKI & SEPATU MERAH (tetap menapak stabil) -->
            <g id="rig-legs">
              <!-- Kaki Kiri -->
              <path d="M 118 236 L 120 324 C 120 328, 124 331, 129 331 L 148 331 C 152 331, 154 328, 154 323 L 154 239 Z"
                    fill="#FFFFFF" stroke="#4A151B" stroke-width="3" stroke-linejoin="round" />
              <!-- Kaki Kanan -->
              <path d="M 202 236 L 200 324 C 200 328, 196 331, 191 331 L 172 331 C 168 331, 166 328, 166 323 L 166 239 Z"
                    fill="#FFFFFF" stroke="#4A151B" stroke-width="3" stroke-linejoin="round" />

              <!-- Sepatu Kiri -->
              <path d="M 120 324 C 108 327, 102 338, 104 348 C 105 353, 114 356, 133 356 C 148 356, 154 352, 154 345 L 154 326 Z"
                    fill="url(#shoeGrad)" stroke="#4A151B" stroke-width="3" stroke-linejoin="round" />
              <path d="M 105 349 C 113 354, 147 354, 153 348" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
              <ellipse cx="122" cy="336" rx="6.5" ry="2.6" transform="rotate(-14 122 336)" fill="#FFFFFF" opacity="0.35" />

              <!-- Sepatu Kanan -->
              <path d="M 200 324 C 212 327, 218 338, 216 348 C 215 353, 206 356, 187 356 C 172 356, 166 352, 166 345 L 166 326 Z"
                    fill="url(#shoeGrad)" stroke="#4A151B" stroke-width="3" stroke-linejoin="round" />
              <path d="M 215 349 C 207 354, 173 354, 167 348" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" />
              <ellipse cx="198" cy="336" rx="6.5" ry="2.6" transform="rotate(14 198 336)" fill="#FFFFFF" opacity="0.35" />
            </g>

            <!-- ================= GRUP TUBUH ATAS (LIVE2D SPRING RIG) ================= -->
            <g id="rig-torso">

              <!-- ===== LENGAN KIRI MULTI-SENDI (TUBE LENTUR, TANPA SAMBUNGAN SIKU) ===== -->
              <g id="arm-left-shoulder" transform="translate(66, 182) rotate(-64)">
                <path id="arm-left-tube-dark" d="M 0 0 L -25 4 L -50 13" fill="none" stroke="#4A151B" stroke-width="23.0" stroke-linecap="round" stroke-linejoin="round" />
                <path id="arm-left-tube-white" d="M 0 0 L -25 4 L -50 13" fill="none" stroke="#FFFFFF" stroke-width="17.4" stroke-linecap="round" stroke-linejoin="round" />
              </g>

              <!-- ===== LENGAN KANAN MULTI-SENDI (TUBE LENTUR, TANPA SAMBUNGAN SIKU) ===== -->
              <g id="arm-right-shoulder" transform="translate(254, 182) rotate(64)">
                <path id="arm-right-tube-dark" d="M 0 0 L 25 4 L 50 13" fill="none" stroke="#4A151B" stroke-width="23.0" stroke-linecap="round" stroke-linejoin="round" />
                <path id="arm-right-tube-white" d="M 0 0 L 25 4 L 50 13" fill="none" stroke="#FFFFFF" stroke-width="17.4" stroke-linecap="round" stroke-linejoin="round" />
              </g>

              <!-- ===== BADAN & LIVERY WHOOSH (URUTAN PRESISI DI DALAM #heiserBodyClip) ===== -->
              <g clip-path="url(#heiserBodyClip)">
                <!-- 1. Pure White Body Base + Shading Halus Bawah -->
                <rect x="46" y="18" width="228" height="266" fill="url(#whiteBodyGrad)" />

                <!-- 2. Top Maroon Hood (#7F1B2A) melengkung masuk di sisi 10 & 2 o'clock menyisakan sayap putih ramping -->
                <path d="M 46 18 L 274 18 L 243 72 C 232 104, 226 144, 224 186 L 96 186 C 94 144, 88 104, 77 72 Z"
                      fill="url(#maroonHoodGrad)" />
                <path d="M 77 72 C 88 104, 94 144, 96 186 L 224 186 C 226 144, 232 104, 243 72"
                      fill="none" stroke="#4A151B" stroke-width="2.2" stroke-linejoin="round" />

                <!-- Highlight Glossy Kubah Atas Kiri -->
                <path d="M 96 58 C 114 39, 144 34, 162 40 C 143 50, 124 60, 107 74 C 97 72, 92 64, 96 58 Z"
                      fill="#FFFFFF" opacity="0.22" />
                <ellipse cx="180" cy="45" rx="8" ry="3" transform="rotate(10 180 45)" fill="#FFFFFF" opacity="0.16" />

                <!-- 3. Sleek Flush Curved Headlamp Cluster & Cheek Fin Kiri -->
                <use href="#headlampLeft" />

                <!-- 3b. Cermin Simetris Matematis untuk Sisi Kanan -->
                <g transform="translate(320, 0) scale(-1, 1)">
                  <use href="#headlampLeft" />
                </g>

                <!-- 4. Pita Livery Merah Whoosh di Perut (#C81D2E, 3.5px) -->
                <path d="M 56 202 C 94 230, 124 242, 160 242 C 196 242, 226 230, 264 202"
                      fill="none" stroke="#C81D2E" stroke-width="3.6" stroke-linecap="round" />
                <path d="M 92 278 C 106 252, 124 238, 134 219 C 139 212, 181 212, 186 219 C 196 238, 214 252, 228 278"
                      fill="none" stroke="#C81D2E" stroke-width="3.4" stroke-linecap="round" />
              </g>

              <!-- 5. CRISP BODY OUTLINE (#4A151B, 3.5px) DI ATAS SEMUA LAYER KLIP -->
              <path d="M 160 26 C 90 26, 56 88, 57 168 C 58 238, 88 276, 160 276 C 232 276, 262 238, 263 168 C 264 88, 230 26, 160 26 Z"
                    fill="none" stroke="#4A151B" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" />

              <!-- ===== GRUP WAJAH 2.5D PARALLAX (MENGIKUTI KURSOR/SENTUHAN) ===== -->
              <g id="rig-face">
                <!-- Layar Wajah Putih Membulat -->
                <path d="M 110 105 C 125 93, 195 93, 210 105 C 219 113, 219 158, 212 170 C 209 175, 200 178, 160 178 C 120 178, 111 175, 108 170 C 101 158, 101 113, 110 105 Z"
                      fill="#FFFFFF" stroke="#4A151B" stroke-width="3" stroke-linejoin="round" />

                <!-- Kilau Tipis di Layar Wajah -->
                <path d="M 117 107 C 132 99, 188 99, 203 107" fill="none" stroke="#F1F5F9" stroke-width="2.6" stroke-linecap="round" />

                <!-- Pipi Merona Pink Lembut -->
                <ellipse id="blush-left" cx="121" cy="153" rx="9.5" ry="4.6" fill="#FDA4AF" opacity="0.78" />
                <ellipse id="blush-right" cx="199" cy="153" rx="9.5" ry="4.6" fill="#FDA4AF" opacity="0.78" />

                <!-- Alis Dinamis -->
                <g id="rig-eyebrows" stroke="#2D1518" stroke-width="2.8" stroke-linecap="round" fill="none">
                  <path id="brow-left" d="M 123 118 Q 133 113 142 117" />
                  <path id="brow-right" d="M 178 117 Q 187 113 197 118" />
                </g>

                <!-- Mata Normal (Glossy + Pupil Eye-Tracking + Blink) -->
                <g id="rig-eyes-normal">
                  <g id="eye-left-group" transform="translate(134, 136)">
                    <circle cx="0" cy="0" r="11.5" fill="#1E1416" />
                    <g id="pupil-left">
                      <circle cx="-3.9" cy="-4.2" r="3.9" fill="#FFFFFF" />
                      <circle cx="4.2" cy="3.7" r="1.8" fill="#FFFFFF" />
                    </g>
                  </g>
                  <g id="eye-right-group" transform="translate(186, 136)">
                    <circle cx="0" cy="0" r="11.5" fill="#1E1416" />
                    <g id="pupil-right">
                      <circle cx="-3.9" cy="-4.2" r="3.9" fill="#FFFFFF" />
                      <circle cx="4.2" cy="3.7" r="1.8" fill="#FFFFFF" />
                    </g>
                  </g>
                </g>

                <!-- Mata Kaget (Putih Lebar + Pupil Kecil) -->
                <g id="rig-eyes-shock" class="hidden">
                  <g id="eye-shock-left-group" transform="translate(134, 136)">
                    <ellipse cx="0" cy="0" rx="14.6" ry="16.0" fill="#FFFFFF" stroke="#1E1416" stroke-width="2.8" />
                    <g id="shock-pupil-left">
                      <circle cx="0.6" cy="1.2" r="6.3" fill="#1E1416" />
                      <circle cx="-1.8" cy="-1.6" r="1.9" fill="#FFFFFF" />
                      <circle cx="3.0" cy="3.4" r="0.8" fill="#FFFFFF" />
                    </g>
                  </g>
                  <g id="eye-shock-right-group" transform="translate(186, 136)">
                    <ellipse cx="0" cy="0" rx="14.6" ry="16.0" fill="#FFFFFF" stroke="#1E1416" stroke-width="2.8" />
                    <g id="shock-pupil-right">
                      <circle cx="-0.6" cy="1.2" r="6.3" fill="#1E1416" />
                      <circle cx="-3.0" cy="-1.6" r="1.9" fill="#FFFFFF" />
                      <circle cx="1.8" cy="3.4" r="0.8" fill="#FFFFFF" />
                    </g>
                  </g>
                </g>

                <!-- Mata Senang (^ ^) -->
                <g id="rig-eyes-happy" class="hidden" stroke="#1E1416" stroke-width="3.8" stroke-linecap="round" fill="none">
                  <path d="M 122 139 Q 134 124 146 139" />
                  <path d="M 174 139 Q 186 124 198 139" />
                </g>

                <!-- ===== MULUT PARAMETRIK (60FPS VOWELS A/I/U/E/O + LIDAH & GIGI) ===== -->
                <g id="rig-mouth" transform="translate(160, 159)">
                  <!-- Mulut Tertutup -->
                  <path id="mouth-closed-path" d="M -11 -1 Q 0 8 11 -1" fill="none" stroke="#2D1518" stroke-width="3.2" stroke-linecap="round" />

                  <!-- Mulut Terbuka Parametrik -->
                  <g id="mouth-open-group" class="hidden">
                    <path id="mouth-cavity" d="M -11 -3 Q 0 -5 11 -3 C 11 8, 6 12, 0 12 C -6 12, -11 8, -11 -3 Z"
                          fill="url(#mouthCavityGrad)" stroke="#2D1518" stroke-width="2.4" stroke-linejoin="round" />
                    <path id="mouth-teeth" d="M -8 -2 Q 0 -3 8 -2 L 7 1 Q 0 0 -7 1 Z" fill="#FFFFFF" />
                    <path id="mouth-tongue" d="M -7 8 Q 0 2 7 8 Q 0 12 -7 8 Z" fill="#FB7185" />
                  </g>
                </g>
              </g>

              <!-- SALINAN LENGAN KANAN DI DEPAN BADAN (hanya pose mikir) -->
              <g id="arm-right-front" class="hidden" transform="translate(254, 182) rotate(26)">
                <path id="arm-right-front-tube-dark" d="M 0 0 L 25 4 L 50 13" fill="none" stroke="#4A151B" stroke-width="23.0" stroke-linecap="round" stroke-linejoin="round" />
                <path id="arm-right-front-tube-white" d="M 0 0 L 25 4 L 50 13" fill="none" stroke="#FFFFFF" stroke-width="17.4" stroke-linecap="round" stroke-linejoin="round" />
              </g>

              <!-- ===== TANGAN DI ATAS BADAN (posisi dihitung dari rantai bahu-siku-pergelangan) ===== -->
              <g id="hand-left" class="arm-click" transform="translate(66, 182) rotate(-64) translate(-50, 13) rotate(-6)">
                <use href="#hand-pose-relaxed" class="hand-left-pose" data-hand="relaxed" />
                <use href="#hand-pose-open" class="hand-left-pose hidden" data-hand="open" />
                <use href="#hand-pose-chest" class="hand-left-pose hidden" data-hand="chest" />
                <use href="#hand-pose-thinking" class="hand-left-pose hidden" data-hand="thinking" />
                <use href="#hand-pose-aha" class="hand-left-pose hidden" data-hand="aha" />
              </g>
              <g id="hand-right" class="arm-click" transform="translate(254, 182) rotate(64) translate(50, 13) scale(-1, 1) rotate(-6)">
                <use href="#hand-pose-relaxed" class="hand-right-pose" data-hand="relaxed" />
                <use href="#hand-pose-open" class="hand-right-pose hidden" data-hand="open" />
                <use href="#hand-pose-chest" class="hand-right-pose hidden" data-hand="chest" />
                <use href="#hand-pose-thinking" class="hand-right-pose hidden" data-hand="thinking" />
                <use href="#hand-pose-aha" class="hand-right-pose hidden" data-hand="aha" />
              </g>
            </g>
          </svg>`;
