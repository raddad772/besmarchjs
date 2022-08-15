"use strict";

const RMSETTINGS = {
    cam: null,              // Placeholder for camera class
    XRES: 900,              // X render resolution
    YRES: 600,              // Y render resolution
    DIST_FOR_HIT: .0000005, // Distance for distance-based hits
    num_threads: 12,        // 12 threads to render with
    OUTPUT_BUFFER_SIZE: 25, // 25 bytes per output pixel. A kind and up to 3 float64's
    BKG_SKY: true,          // Make the background sky-ish?
    DO_GLOW: false,         // Do a glow effect
    GLOW_COLOR: new vec3(.1, 1, .25),
    MAX_MARCHES: 1000,      // Maximum number of marches
    DO_HIT_MAP: false,
}

const NMAX = 0x7FFFFFFFF

function dot3(vec1, vec2) {
    return (vec1.x*vec2.x) + (vec1.y*vec2.y) + (vec1.z*vec2.z);
}

class raymarch_request_t {
    constructor(scene, output_buffer, y_start, y_end) {
        this.settings = RMSETTINGS;
        this.output_buffer = output_buffer;
        this.scene = scene;
        this.y_start = y_start;
        this.y_end = y_end;
    }
}

const HIT_KINDS = {
    MISS: 0,
    COLOR: 1,
    NORMAL: 2,
    STEP_COUNTED: 3
}

class light_t {
    constructor(pos=null, strength=null) {
        if (pos === null) this.pos = new vec3();
        else this.pos = new vec3(pos);

        this.strength = strength;
    }
}

class doublesphere_t {
    constructor() {
        this.distance = 0;
        this.ref_name = "doublepshere";
        this.color = new vec3(1.0, 1.0, 1.0);

        this.has_surface_shader = true;
        this.has_surface_normal = true;

        this.pos1 = new vec3();
        this.radius1 = 1.0;
        this.pos2 = new vec3();
        this.radius2 = 1.0;
    }

    dist_func(where) {

    }
}

class mandelbulb2_t {
    constructor() {
        this.distance = 0;
        this.ref_name = "mandelbulb v2";
        this.color = new vec3(1.0, 1.0, 1.0);

        this.has_surface_normal = true;
        this.has_surface_shader = false;

        this.bailout = 500000;
        this.iterations = 1000;
        this.power = 8;
        this.last = 0;
        this.gradient = 0;
    }

    /** @param {vec3} pos
     **/
    escapeLength(pos)
    {
        let z = new vec3(pos);
        for (let i=1; i < this.iterations; i++) {
            z = BulbPower(z, this.power).add(pos);
            let r2 = dot3(z, z);
            if ((r2 > this.bailout && this.last === 0) || (i === this.last)) {
                this.last = i;
                return z.magnitude();
            }
        }
        return z.magnitude();
	}

    dist_func(pos) {
        this.last = 0;
        let r = this.escapeLength(pos);
        if (r*r<this.bailout) return 0.0;
        this.gradient = (vec3(escapeLength(p+xDir*EPS), escapeLength(p+yDir*EPS), escapeLength(p+zDir*EPS))-r)/EPS;
        return 0.5*r*log(r)/length(gradient);
    }

}

class sphere_t {
    constructor() {
        // A valid ray-marching object has these two important things:
        // a distance function,
        // and a member to store the current distance.
        this.distance = 0;
        this.ref_name = "hello sphere";
        this.color = new vec3(0, 0.5, 0.75);

        this.has_surface_shader = true;
        this.has_surface_normal = true;
        this.shade_based_on_steps = false;

        // These are all "private"
        this.pos = new vec3();
        this.radius = 1.0;
    }

    surface_shade(scene, ray, cam) {
        let light = new vec3(scene.lights[0].pos).subtract(ray.pos).normalize();
        let dp = dot3(light, this.surface_normal(ray.pos));
        if (dp < 0) dp = 0;
        return new vec3(dp*this.color.x, dp*this.color.y, dp*this.color.z);
    }

    surface_normal(where) {
        return new vec3(where).subtract(this.pos).normalize();
    }

    dist_func(what) {
        // Signed distance from surface
        return (Math.abs(this.pos.distance(what)) - this.radius);
    }
}

var canvas;
const pi = Math.PI;

const ui_el = {
    dist_for_hit_input: ['distforhit', DIST_FOR_HIT],
}

class raymarcher_t {
    constructor(imgdata) {
        this.imgdata = imgdata;
        this.workers = new Array(RMSETTINGS.num_threads);
        if (RMSETTINGS.num_threads > 1) {
            for (let w = 0; w < RMSETTINGS.num_threads; w++) {
                //this.workers[w] = new Worker('snes_ppu_worker.js');
                /*if (PPU_USE_BLOBWORKERS) {
                    this.workers[w] = new Worker(URL.createObjectURL(new Blob(["(" + PPU_worker_function.toString() + ")()"], {type: 'text/javascript'})));
                } else {*/
                this.workers[w] = new Worker('render_worker.js');
                //}
                //const myWorker = new Worker("worker.js");
                this.workers[w].onmessage = this.on_worker_message.bind(this);
            }
        }
        this.workers_finished = 0;
        this.output_buffer = new SharedArrayBuffer(RMSETTINGS.XRES * RMSETTINGS.YRES * RMSETTINGS.OUTPUT_BUFFER_SIZE)
    }

    dispatch_to_worker(num, msg) {
        this.workers[num].postMessage(msg);
    }

    present() {
        console.log('TIME TO DECODE WHAT THE WORKERS SENT AND PAINT TO DISPLAY...');
        let color = new vec3();
        let inbuffer = new Uint8Array(this.output_buffer);
        let hitdata = new hit_t();
        for (let y = 0; y < RMSETTINGS.YRES; y++) {
            for (let x = 0; x < RMSETTINGS.XRES; x++) {
                let psb = ((y * RMSETTINGS.XRES) + x) * RMSETTINGS.OUTPUT_BUFFER_SIZE;

                hitdata.deserialize(this.output_buffer, psb);
                switch(hitdata.kind) {
                    case HIT_KINDS.MISS:
                        color.set(1, 0, 0);
                        break;
                    case HIT_KINDS.COLOR:
                        color.copy(hitdata.color);
                        break;
                    case HIT_KINDS.NORMAL:
                        console.log("UHHH why did I make this");
                        break;
                    case HIT_KINDS.STEP_COUNTED:
                        // Do step count stuff here
                        break;
                }
            }
        }


                /*let pid = ((y * RMSETTINGS.XRES) + x) * 4;
                this.imgdata[pid] = r;
                this.imgdata[pid+1] = g;
                this.imgdata[pid+2] = b;
                this.imgdata[pid+3] = 255;*/

        this.then();
    }

    on_worker_message(e) {
        this.workers_finished++;
        if (this.workers_finished >= RMSETTINGS.num_threads) {
            this.present();
        }
    }

    render(scene, then) {
        this.then = then;
        // 90 degrees (0) is at pi/2
        // 180 degrees (+1) at pi
        // 270 degrees (-1) at pi * (3/2)

        // complete circle in 2 pi
        let angle = 270;
        let degrees_to_radians = function(degrees) { return (degrees / 180) * pi };

        let cam = new raycamera();
        cam.pos.set(1, 0, 1.5)
        let roto = degrees_to_radians(-30);
        cam.angle.set(0, roto, 0);
        cam.setup_viewport(RMSETTINGS.XRES, RMSETTINGS.YRES, 90);
        cam.zoom = 1;
        console.log('Setting up rays')
        cam.generate_vectors(vecs);
        console.log('Setting up scene')
        RMSETTINGS.cam = cam;
        let slices = [];
        // R G B, Z, N
        let slice_size = Math.floor(RMSETTINGS.YRES / RMSETTINGS.num_threads);
        let y = 0;
        for (let threadnum=0; threadnum<RMSETTINGS.num_threads; threadnum++) {
            slices[threadnum] = new raymarch_request_t(scene, this.output_buffer, y, (y+slice_size)-1);
            y += slice_size;
        }
        this.workers_finshed = 0;
        for (let i = 0; i<RMSETTINGS.num_threads; i++) {
            this.dispatch_to_worker(i, slices[i]);
        }
    }
}

class hit_scaler_t {
    constructor(max_hits) {
        this.max_hits = max_hits * 0.5;

        this.mh = this.max_hits;
        this.ig = 1/5;

    }
    scale(num) {
        //let r = Math.log2(num) / Math.log2(this.max_hits);
        let r = num / this.max_hits;
        if (r > 1) r = 1;
        return 1 - Math.pow(r, this.ig);
        //return 1.0 - r;
    }

}

function make_scene() {
    let scene = new scene_t();
    let sphere = new sphere_t();
    let light = new light_t();
    light.pos.set(0, -10.0, 0.0)
    sphere.pos.set(0, 0, 0);
    sphere.radius = 0.5;
    //scene.add_object(sphere);
    scene.add_light(light);
    let mbulb = new mandelbulb_t();
    scene.add_object(mbulb);

    return scene;
}

/*    if (DO_HIT_MAP) {
        let scaler = new hit_scaler_t(max_hits);
        for (let y = 0; y < YRES; y++) {
            for (let x = 0; x < XRES; x++) {
                let part = y*XRES + x;
                let hm = hit_map[part];
                if (hm !== 0) {
                    let c = scaler.scale(hm);
                    color.set(c, c, c);
                    let dp = (y * XRES + x) * 4;
                    imgdata[dp] = (color.x * 255) >> 0;
                    imgdata[dp + 1] = (color.y * 255) >> 0;
                    imgdata[dp + 2] = (color.z * 255) >> 0;
                    imgdata[dp + 3] = 255;
                }
            }
        }
    }*/

function main() {
    canvas = document.getElementById('drawhere');
    var ctx = canvas.getContext('2d');
    var imgdata = ctx.getImageData(0, 0, RMSETTINGS.XRES, RMSETTINGS.YRES);

    let renderer = new raymarcher_t(imgdata.data, scene);
    let scene = make_scene();
    renderer.render(scene, function() {
        console.log('DONE!');
        ctx.putImageData(imgdata, 0, 0);
        console.log('PUT!');
    });
}

window.onload = main;