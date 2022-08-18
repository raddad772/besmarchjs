"use strict";

let xres = 900;
let yres = 600;
let nthreads = 4;
let yslices = yres / nthreads;
let xslices = 1;
console.log('SLICES', xslices * yslices);


const RMSETTINGS = {
    cam: null,              // Placeholder for camera class
    XRES: xres,              // X render resolution
    YRES: yres,              // Y render resolution
    DIST_FOR_HIT: .0000005, // Distance for distance-based hits
    num_threads: nthreads,        // Number of worker threads
    num_slices: xslices * yslices,          // Number of slices to slice screen into
    xslices: xslices,
    yslices: yslices,
    OUTPUT_BUFFER_SIZE: 25, // 25 bytes per output pixel. A kind and up to 3 float64's
    BKG_SKY: true,          // Make the background sky-ish?
    DO_GLOW: true,         // Do a glow effect
    GLOW_COLOR: new vec3(.1, 1, .25),
    MAX_MARCHES: 1000,      // Maximum number of marches
    DO_HIT_MAP: false,
}


class raymarch_request_t {
    constructor(x_start, x_end, y_start, y_end, request_id) {
        this.kind = 'march';
        this.x_start = x_start;
        this.x_end = x_end;
        this.y_start = y_start;
        this.y_end = y_end;
        this.request_id = request_id;
    }
}

class raymarch_setup_t {
    /**
     * @param {scene_t} scene
     * @param {SharedArrayBuffer} output_buffer
     * @param {raycam_t} cam
     * @param {SharedArrayBuffer} shared_counters
     * @param {Number} worker_num
     */
    constructor(scene, output_buffer, cam, shared_counters, worker_num) {
        this.settings = RMSETTINGS;
        this.output_buffer = output_buffer;
        this.scene = scene;
        this.cam = cam;
        this.shared_counters = shared_counters;
        this.kind = 'setup scene';
        this.request_id = 0;
        this.worker_num = worker_num;
    }
}

class doublesphere_t {
    constructor() {
        this.distance = 0;
        this.ref_name = "doublepshere";
        this.color = new vec3(1.0, 1.0, 1.0);

        this.has_surface_shader = true;
        this.has_surface_normal = true;
        this.hit_sub_zero = true;
        this.shading_method = SHADING_METHODS.SHADED;

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
        this.hit_sub_zero = false;
        this.shading_method = SHADING_METHODS.STEP_COUNT;


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


var canvas;
const pi = Math.PI;

const ui_el = {
    dist_for_hit_input: ['distforhit', RMSETTINGS.DIST_FOR_HIT],
}

const NUM_SHARED_COUNTERS = 4;

class raymarcher_t {
    constructor(imgdata) {
        this.imgdata = imgdata;
        this.workers = new Array(RMSETTINGS.num_threads);
        if (RMSETTINGS.num_threads > 1) {
            for (let w = 0; w < RMSETTINGS.num_threads; w++) {
                this.workers[w] = new Worker('render_worker.js');
                this.workers[w].onmessage = this.on_worker_message.bind(this);
            }
        }
        this.workers_finished = 0;
        this.output_buffer = new SharedArrayBuffer(RMSETTINGS.XRES * RMSETTINGS.YRES * RMSETTINGS.OUTPUT_BUFFER_SIZE)
        this.hit_scaler = new hit_scaler_t(RMSETTINGS.MAX_MARCHES);
        this.glow_scaler = new glow_scaler_t(RMSETTINGS.MAX_MARCHES, 100, 0.2, 1);
        this.cam = null;
        this.counters_sab = new SharedArrayBuffer(4*NUM_SHARED_COUNTERS);
        this.shared_counters = new Int32Array(this.counters_sab);
        this.total_lines = 0;

        this.waiting_on = {
            pos: 0,
            value: 0,
            notnext: null, //function(worker_num){},
            next: function(){console.log('UNBOUND WAIT FINISH!'); debugger;},
            next_done: false,
        }
        this.scene = new scene_t();
        this.cam = new raycam_t();
        this.render_slices = [];
        this.render_slice_pos = 0;
        this.render_slices_returned = 0;

        this.last_logged_percent = 0;
    }

    dispatch_to_worker(num, msg) {
        this.workers[num].postMessage(msg);
    }

    hit_map(steps) {
        let color = new vec3(0, 0, 0);
        if (steps !== 0) {
            let c = this.hit_scaler.scale(steps);
            color.set(c, c, c);
            //let dp = (y * RMSETTINGS.XRES + x) * 4;
            return color;
        }
        else return null;
    }

    present() {
        console.log('TIME TO DECODE WHAT THE WORKERS SENT AND PAINT TO DISPLAY...');
        let color = new vec3();
        let inbuffer = new Uint8Array(this.output_buffer);
        let hitdata = new hit_t();
        let r;
        let steps = 0;
        for (let y = 0; y < RMSETTINGS.YRES; y++) {
            for (let x = 0; x < RMSETTINGS.XRES; x++) {
                let psb = ((y * RMSETTINGS.XRES) + x) * RMSETTINGS.OUTPUT_BUFFER_SIZE;
                let dp = (y * RMSETTINGS.XRES) + x;
                let do_miss = true;
                hitdata.deserialize(inbuffer, psb);
                switch(hitdata.kind) {
                    case HIT_KINDS.MISS:
                        steps = hitdata.step_count;
                        break;
                    case HIT_KINDS.COLOR:
                        do_miss = false;
                        color.copy(hitdata.color);
                        break;
                    case HIT_KINDS.NORMAL:
                        console.log("UHHH why did I make this");
                        break;
                    case HIT_KINDS.STEP_COUNTED:
                        r = this.hit_map(hitdata.step_count);
                        if (r !== null) {
                            color.copy(r);
                            do_miss = false;
                        }
                        else {
                            steps = hitdata.step_count;
                        }
                        break;
                }
                if (do_miss) {
                    color.set(0, 0, 0);
                    if (RMSETTINGS.BKG_SKY) {
                        let t = (0.5 * this.cam.view_vectors[dp].y) + 1.0;
                        color.set(1.0 - t, 1.0 - t, 1.0 - t);
                        color.add(new vec3(0.5, 0.7, 1.0).scale_by(t));
                        color.normalize_1();
                        // Add a glow if we came close
                    }
                    if (RMSETTINGS.DO_GLOW) {
                        this.glow_scaler.scale(steps, color);
                        color.normalize_1();
                    }
                }
                dp *= 4;
                /*this.imgdata[dp] = Math.floor(color.x * 255);
                this.imgdata[dp+1] = Math.floor(color.y * 255);
                this.imgdata[dp+2] = Math.floor(color.z + 255);*/
                this.imgdata[dp] = (color.x * 255) >> 0;
                this.imgdata[dp+1] = (color.y * 255) >> 0;
                this.imgdata[dp+2] = (color.z * 255) >> 0;
                this.imgdata[dp+3] = 255;
            }
        }


                /*let pid = ((y * RMSETTINGS.XRES) + x) * 4;
                this.imgdata[pid] = r;
                this.imgdata[pid+1] = g;
                this.imgdata[pid+2] = b;
                this.imgdata[pid+3] = 255;*/
        console.log('TIME TO CALL NEXT');
        this.then();
    }

    on_worker_message(e) {
        // Check the waiting_on.pos for waiting_on.value and perform waiting_on.next if so
        let v = Atomics.load(this.shared_counters, this.waiting_on.pos);
        //console.log('GOT', v, 'OF', this.waiting_on.value);

        if (v === this.waiting_on.value) {
            if (!this.waiting_on.next_done) {
                this.waiting_on.next_done = true;
                this.waiting_on.next();
            }
        }
        else {
            if (this.waiting_on.notnext !== null) {
                this.render_slices_returned++;
                let perc = Math.floor((this.render_slices_returned / this.render_slices.length) * 100);
                if ((perc - this.last_logged_percent) >= 5) {
                    console.log('Returned %:', perc);
                    this.last_logged_percent = perc;
                }
                this.waiting_on.notnext(e.data.worker_num);
            }
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

        //this.cam = new raycam_t();

        // View from kindof the side
        this.cam.pos.set(1, 0, 1.5).scale_by(2);
        let roto = degrees_to_radians(-30);
        this.cam.angle.set(0, roto, 0);

        // Straight-on view
        /*this.cam.pos.set(0, 0, 4);
        this.cam.angle.set(0, 0, 0);*/

        this.cam.setup_viewport(RMSETTINGS.XRES, RMSETTINGS.YRES, 90);
        this.cam.zoom = 1;
        console.log('Setting up rays')
        this.cam.generate_vectors();
        console.log('Setting up scene')
        RMSETTINGS.cam = this.cam;

        this.scene.setup_from(scene);

        this.setup_workers(this.render_workers.bind(this));
    }

    setup_workers(next) {
        console.log('Sending scene to workers...');
        this.waiting_on.pos = 0;
        this.waiting_on.value = RMSETTINGS.num_threads;
        this.waiting_on.next = next;
        this.waiting_on.next_done = false;
        Atomics.store(this.shared_counters, 0, 0);
        for (let threadnum=0; threadnum<RMSETTINGS.num_threads; threadnum++) {
            console.log(threadnum);
            let rq = new raymarch_setup_t(this.scene, this.output_buffer, this.cam, this.counters_sab, threadnum);
            this.dispatch_to_worker(threadnum, rq);
        }
    }

    render_workers() {
        console.log('Setup complete, begin render')
        let RENDER_REQ_ID = 1;
        let y_slice_size = Math.floor(RMSETTINGS.YRES / RMSETTINGS.yslices);
        let x_slice_size = Math.floor(RMSETTINGS.XRES / RMSETTINGS.xslices);
        let y = 0;
        this.waiting_on.pos = RENDER_REQ_ID;
        this.render_slices = [];
        this.render_slice_pos = 0;
        this.render_slices_returned = 0;
        let slice_num = 0;
        while(y < RMSETTINGS.YRES) {
            let x = 0;
            while (x < RMSETTINGS.XRES) {
                this.render_slices[slice_num++] = new raymarch_request_t(x, (x+x_slice_size)-1, y, (y+y_slice_size)-1, this.waiting_on.pos);
                x += x_slice_size;
            }
            y += y_slice_size;
        }

        this.waiting_on.value = this.render_slices.length;
        this.waiting_on.next = this.present.bind(this);
        this.waiting_on.notnext = this.send_render_slice.bind(this);
        this.waiting_on.next_done = false;
        // scene, this.output_buffer, this.cam, this.shared_counters
        for (let i = 0; i<RMSETTINGS.num_threads; i++) {
            this.send_render_slice(i);
        }
    }

    send_render_slice(worker_num) {
        if (this.render_slice_pos >= this.render_slices.length) {
            return;
        }
        this.dispatch_to_worker(worker_num, this.render_slices[this.render_slice_pos]);
        this.render_slice_pos++;
    }
}

class glow_scaler_t {
    constructor(max_hits, area, threshold, multiplier) {
        this.max_hits = max_hits;
        this.area = area;
        this.multiplier = multiplier;
        this.threshold = threshold;
    }

    scale(num, vec) {
        let glow = (num / this.area);
        if (glow > 1) glow = 1;
        glow = glow > this.threshold ? (this.multiplier * glow) : 0;
        vec.add(new vec3(RMSETTINGS.GLOW_COLOR.x, RMSETTINGS.GLOW_COLOR.y, RMSETTINGS.GLOW_COLOR.z).scale_by(glow));
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
    let plane = new plane_t();
    let obj = new obj2_t();
    obj.obj1 = new sphere_t();
    obj.obj2 = new sphere_t();
    obj.obj1.pos.set(-.8, 0, 0);
    obj.obj1.radius = .6;
    obj.obj2.pos.set(.25, 0, 0);
    obj.obj2.radius = .8;

    plane.color.set(0, 0.75, 0);
    plane.a = 0;
    plane.b = 1.25;
    plane.c = 0;
    plane.d = -1.25; // -.25 will bisect bottom half of sphere
    light.pos.set(0, -10.0, 0.0)
    sphere.pos.set(0, 0, 0);
    sphere.radius = 0.5;
    let box = new box_t();
    box.s.set(1, 1, 1);
    box.c.set(0, 0, 0);
    scene.add_object(box);
    //scene.add_object(sphere);
    //scene.add_object(obj);
    scene.add_light(light);
    scene.add_object(plane);
    let mbulb = new mandelbulb_t();
    //scene.add_object(mbulb);

    return scene;
}

function main() {
    canvas = document.getElementById('drawhere');
    var ctx = canvas.getContext('2d');
    var imgdata = ctx.getImageData(0, 0, RMSETTINGS.XRES, RMSETTINGS.YRES);

    let scene = make_scene();
    let renderer = new raymarcher_t(imgdata.data, scene);
    renderer.render(scene, function() {
        console.log('DONE!');
        ctx.putImageData(imgdata, 0, 0);
        console.log('PUT!');
    });
}

window.onload = main;