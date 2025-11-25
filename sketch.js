let overwhelmedInstance; 
let capture; // Variable for webcam

// Intense and slightly clashing color palettes
const overwhelmedPalette1 = {
  bg: '#111111',      // Very Dark Grey
  primary: '#FF4500',  // Orange Red (e.g., Vermilion)
  accent1: '#FFD700',  // Gold (e.g., Bright Yellow)
  accent2: '#8A2BE2',  // Blue Violet (e.g., Electric Purple)
};

const overwhelmedPalette2 = {
  bg: '#1a0a2a',      // Dark Purple-ish
  primary: '#E91E63',  // Deep Pink
  accent1: '#00BCD4',  // Cyan Blue
  accent2: '#FFC107',  // Amber Yellow
};

const alarmPalette = { // For the burst flash
    primary: '#FF0000', // Bright Red
    accent1: '#00FF00', // Bright Green
    accent2: '#0000FF', // Bright Blue
};

// --- UI Logic ---
function toggleInfo() {
    const infoBox = document.getElementById('interaction-instructions');
    const icon = document.getElementById('toggle-icon');
    
    // Toggle the class
    infoBox.classList.toggle('collapsed');

    // Update icon text
    if (infoBox.classList.contains('collapsed')) {
        icon.innerText = "+";
    } else {
        icon.innerText = "−"; // minus sign
    }
}

function setup() {
  console.log("setup() called - creating canvas for Overwhelmed");
  createCanvas(windowWidth, windowHeight);
  
  // Use HSB as requested in original code
  colorMode(HSB, 360, 100, 100, 1); 
  
  // --- FIX: Performance Optimization ---
  pixelDensity(1);

  // --- VIDEO CAPTURE SETUP ---
  capture = createCapture(VIDEO);
  capture.size(320, 240); 
  capture.hide(); 

  // Attach the event listener to the info box
  const infoBox = document.getElementById('interaction-instructions');
  if (infoBox) {
      infoBox.addEventListener('click', toggleInfo);
  }
  
  overwhelmedInstance = new Overwhelmed();
  overwhelmedInstance.setup();
  console.log("overwhelmedInstance setup complete");
}

function draw() {
  if (overwhelmedInstance) {
    // IMPORTANT: The Overwhelmed class uses translate(width/2, height/2).
    // We wrap it in push/pop so the translation doesn't affect the video drawn afterwards.
    push();
    overwhelmedInstance.draw();
    pop();
  } else {
    background(0); 
    fill(0, 100, 100); 
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Error: overwhelmedInstance not loaded", width/2, height/2);
  }

  // --- DRAW VIDEO CAPTURE (Bottom Left) ---
  if (capture && capture.loadedmetadata) {
      let vidWidth = 230; // Matches info box width
      let vidHeight = (capture.height / capture.width) * vidWidth; 
      
      let x = 20; // Left margin
      let y = height - vidHeight - 20; // Bottom margin
      
      push();
      // Draw video
      image(capture, x, y, vidWidth, vidHeight);
      
      // REMOVED BORDER
      // noFill();
      // stroke(270, 80, 90, 0.8); 
      // strokeWeight(2);
      // rect(x, y, vidWidth, vidHeight);
      pop();
  }
}

function windowResized() {
  console.log("windowResized() called");
  resizeCanvas(windowWidth, windowHeight);
  if (overwhelmedInstance) {
    overwhelmedInstance.onResize();
  }
}

function mousePressed(event) {
  // Prevent interaction if clicking inside the interaction box
  if (event && event.target.closest('#interaction-instructions')) return;

  if (overwhelmedInstance) {
    overwhelmedInstance.mousePressed();
  }
}


// --- Overwhelmed class for managing shards ---
class Overwhelmed {
  constructor() {
    this.shards = [];
    this.numShards = 250; // High number for density
    this.backgroundColor;
    this.currentPalette;
    this.timeOffset = 0; // General time for noise evolution

    // Click burst properties (Paralyze & Shatter)
    this.burstActive = false;
    this.burstOrigin = createVector(0,0);
    this.burstStartTime = 0;
    this.burstFreezeDuration = 100; // Time frozen at start of burst
    this.burstShatterDuration = 400; // Time fragments are expelled
    this.burstRadius = 300; // Max radius for burst effect
    this.burstForce = 15; // Initial outward push
  }

  setup() {
    angleMode(DEGREES);
    this.applyPalette(overwhelmedPalette1); 
    background(this.backgroundColor); 
    this.initShards();
  }

  initShards() {
    this.shards = [];
    for (let i = 0; i < this.numShards; i++) {
      this.shards.push(new OverwhelmedShard(this.currentPalette, this)); // Pass 'this' reference
    }
  }

  draw() {
    // Clear background completely each frame to prevent trails and emphasize jitter
    background(this.backgroundColor); 

    translate(width / 2, height / 2); // Center drawing

    this.timeOffset += 0.008; // Advance general time

    // Check burst state
    let isFrozen = false;
    let isShattering = false;
    let burstProgress = 0;
    if (this.burstActive) {
      let timeElapsed = millis() - this.burstStartTime;
      if (timeElapsed < this.burstFreezeDuration) {
        isFrozen = true; // Particles freeze during this phase
      } else if (timeElapsed < (this.burstFreezeDuration + this.burstShatterDuration)) {
        isShattering = true; // Particles are pushed out during this phase
        burstProgress = map(timeElapsed - this.burstFreezeDuration, 0, this.burstShatterDuration, 0, 1);
      } else {
        this.burstActive = false; // Burst effect ends
      }
    }

    // Update and draw shards
    for (let shard of this.shards) {
      shard.update(mouseX - width/2, mouseY - height/2, this.timeOffset, isFrozen, isShattering, this.burstOrigin, burstProgress);
      shard.show(this.burstActive, isFrozen, this.burstStartTime);
    }
  }

  applyPalette(palette) {
    this.currentPalette = palette;
    this.backgroundColor = color(palette.bg);
    for(let shard of this.shards) {
        shard.updatePalette(palette);
    }
  }

  onResize() {
    resizeCanvas(windowWidth, windowHeight);
    this.initShards(); // Reinitialize shards on resize
    background(this.backgroundColor); 
  }

  mousePressed() {
    // Trigger the burst effect
    this.burstActive = true;
    this.burstOrigin = createVector(mouseX - width/2, mouseY - height/2); 
    this.burstStartTime = millis();
    
    // Also switch palette on click for visual variation
    if (this.currentPalette === overwhelmedPalette1) {
      this.applyPalette(overwhelmedPalette2);
    } else {
      this.applyPalette(overwhelmedPalette1);
    }
    background(this.backgroundColor); // Clear with new background
  }
}


// --- OverwhelmedShard class ---
class OverwhelmedShard {
  constructor(palette, parentSketch) {
    this.pos = createVector(random(-width/2, width/2), random(-height/2, height/2)); 
    this.vel = createVector(random(-1, 1), random(-1, 1)); // Initial random velocity
    this.acc = createVector(0, 0);

    this.baseRotation = random(360); // Base rotation angle
    this.rotationSpeed = random(-5, 5); // Constant rotation speed

    this.size = random(8, 20); // Size of the shard
    this.numVertices = floor(random(3, 5)); // Triangle or Quad
    this.vertices = []; // Store relative vertex positions

    this.palette = palette;
    this.parent = parentSketch; // Reference to the parent sketch
    this.id = random(10000); // Unique ID for noise calculations

    this.resetVertices();
  }

  resetVertices() {
    this.vertices = [];
    for (let i = 0; i < this.numVertices; i++) {
        let angle = map(i, 0, this.numVertices, 0, 360);
        let r = this.size / 2 + random(-this.size * 0.2, this.size * 0.2); // Jaggedness
        this.vertices.push(p5.Vector.fromAngle(angle).setMag(r));
    }
  }

  updatePalette(newPalette) {
      this.palette = newPalette;
  }

  update(mouseX, mouseY, globalTime, isFrozen, isShattering, burstOrigin, burstProgress) {
    if (isFrozen) {
      this.vel.mult(0); // Stop movement
      this.acc.mult(0); // Clear acceleration
      this.rotationSpeed = 0; // Stop rotation
      return; // Skip further movement updates
    }

    // Resume rotation if not bursting
    this.rotationSpeed = random(-5, 5); // Resume random rotation

    // Chaotic Perlin noise force
    let xOff = this.pos.x * 0.005;
    let yOff = this.pos.y * 0.005;
    let noiseAngle = noise(xOff, yOff, this.id + globalTime * 2) * 360 * 4; // High frequency, wide range
    let noiseForce = p5.Vector.fromAngle(noiseAngle);
    this.acc.add(noiseForce.setMag(0.2)); // Strong noise influence

    // Mouse Attraction (weak, constantly fought against)
    let distToMouse = dist(this.pos.x, this.pos.y, mouseX, mouseY);
    let attractionRadius = 100;
    let maxMouseAttraction = 0.05;
    if (distToMouse < attractionRadius) {
        let attractForce = p5.Vector.sub(createVector(mouseX, mouseY), this.pos);
        attractForce.setMag(map(distToMouse, 0, attractionRadius, maxMouseAttraction, 0));
        this.acc.add(attractForce);
    }
    
    // BURST - Shattering Phase
    if (isShattering) {
        let distToBurst = dist(this.pos.x, this.pos.y, burstOrigin.x, burstOrigin.y);
        if (distToBurst < this.parent.burstRadius) {
            // Apply a strong initial outward force once
            if (burstProgress < 0.1 && this.vel.mag() < 10) { // Only apply if velocity is low
                 let outwardForce = p5.Vector.sub(this.pos, burstOrigin);
                 if (outwardForce.mag() === 0) outwardForce = p5.Vector.random2D();
                 outwardForce.setMag(this.parent.burstForce);
                 this.acc.add(outwardForce);
            }
        }
    }


    this.vel.add(this.acc);
    this.vel.limit(5); // Maximum speed for shards
    this.pos.add(this.vel);
    this.acc.mult(0.85); // Moderate damping, maintains energy

    this.baseRotation += this.rotationSpeed; // Apply rotation
    
    // Wrap around screen edges
    if (this.pos.x > width / 2 + this.size) this.pos.x = -width / 2 - this.size;
    else if (this.pos.x < -width / 2 - this.size) this.pos.x = width / 2 + this.size;
    if (this.pos.y > height / 2 + this.size) this.pos.y = -height / 2 - this.size;
    else if (this.pos.y < -height / 2 - this.size) this.pos.y = height / 2 + this.size;
  }

  show(burstActive, isFrozen, burstStartTime) {
    noStroke();

    let finalColor;
    if (burstActive && isFrozen) { // During freeze phase of burst
        // Rapidly flash between alarm colors
        let flashTime = millis() - burstStartTime;
        let flashIndex = floor(flashTime / 50) % 3; // Cycle every 50ms
        if (flashIndex === 0) finalColor = color(alarmPalette.primary);
        else if (flashIndex === 1) finalColor = color(alarmPalette.accent1);
        else finalColor = color(alarmPalette.accent2);
    } else {
        // Normal color logic
        let primaryCol = color(this.palette.primary);
        let accent1Col = color(this.palette.accent1); 
        let accent2Col = color(this.palette.accent2); 

        let lerpFactor = map(noise(this.id + this.parent.timeOffset * 0.5), 0, 1, 0, 1); // Slower color shift
        if (lerpFactor < 0.5) {
            finalColor = lerpColor(primaryCol, accent1Col, lerpFactor * 2);
        } else {
            finalColor = lerpColor(accent1Col, accent2Col, (lerpFactor - 0.5) * 2);
        }

        // Keep saturation and brightness high, but a bit of flicker based on noise
        let h = hue(finalColor);
        let s = saturation(finalColor);
        let b = brightness(finalColor);

        s = constrain(s + map(noise(this.id + this.parent.timeOffset * 1.5), 0, 1, -15, 15), 80, 100); // More dramatic flicker
        b = constrain(b + map(noise(this.id + this.parent.timeOffset * 1.5 + 100), 0, 1, -15, 15), 70, 100);

        finalColor = color(h, s, b, 0.9); // Slightly transparent
    }


    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.baseRotation);
    fill(finalColor);

    beginShape();
    for (let v of this.vertices) {
        vertex(v.x, v.y);
    }
    endShape(CLOSE);
    pop();
  }
}