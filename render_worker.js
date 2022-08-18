"use strict";


importScripts('vec3.js');
importScripts('matrix3d.js');
importScripts('raycam.js');
importScripts('shapes/geometric_forms.js');
importScripts('shapes/mandelbulb.js');
importScripts('multithread_support.js');

let RMSETTINGS;

class raymarching_worker_t {
    constructor(worker_number, scene, cam, settings, output_buffer, shared_counters, request_id) {
        this.scene = new scene_t();
        this.cam = new raycam_t();
        this.worker_num = worker_number;
        this.setup_scene(scene);
        this.setup_cam(cam);
        RMSETTINGS = settings;
        this.output_sab = output_buffer;
        this.counters_sab = shared_counters;

        this.shared_counters = new Int32Array(this.counters_sab);
        this.output_buffer = new Uint8Array(this.output_sab);
        this.complete_work(request_id, 1);
    }

    complete_work(request_id, value) {
        let a = Atomics.add(this.shared_counters, request_id, value);
        // Tell main thread to check if work is done
        // Also tell it which worker number is now free
        postMessage({worker_num: this.worker_num});
    }

    march(x_start, x_end, y_start, y_end, request_id) {
        let color = new vec3();
        let counter = 0
        let min_was;

        for (let y = y_start; y <= y_end; y++) {
            for (let x = x_start; x <= x_end; x++) {
                let dp = (y * RMSETTINGS.XRES) + x;
                let ray = new ray_t(RMSETTINGS.cam.pos, this.cam.view_vectors[dp]);
                let hit_data = new hit_t();
                let hit = false;
                let oob = new vec3();
                for (ray.num_steps = 0; ray.num_steps < RMSETTINGS.MAX_MARCHES; ray.num_steps++) {
                    let dist = this.scene.min_distance(ray.pos);
                    hit = false;
                    min_was = this.scene.min_was;
                    if (min_was !== null) {
                        if (min_was.hit_only_sub_zero) {
                            hit = dist <= 0;
                        }
                        else {
                            hit = dist <= RMSETTINGS.DIST_FOR_HIT
                            if (min_was.hit_sub_zero) {
                                hit |= dist <= 0;
                            }
                        }
                        if (hit) break;
                    }
                    else {
                        debugger;
                    }
                    ray.pos.add(new vec3(ray.dir).scale_by(dist));
                    if (oob.copy(ray.pos).subtract(this.scene.bounding_sphere.pos).magnitude() > this.scene.bounding_sphere.radius) break;
                }
                if (!hit) {
                    // Set number of steps missed
                    hit_data.kind = HIT_KINDS.MISS;
                    hit_data.step_count = ray.num_steps;
                } else {
                    // Determine hit type
                    let obj = this.scene.min_was;
                    switch(obj.props.shading_method) {
                        case SHADING_METHODS.SHADED:
                            hit_data.kind = HIT_KINDS.COLOR;
                            if (obj.props.has_surface_shader) {
                                hit_data.color.copy(obj.surface_shade(this.scene, ray, this.cam));
                            } else if (obj.props.has_surface_normal) {
                                hit_data.color.copy(obj.surface_normal(ray.pos)).abself().add(new vec3(1.0, 1.0, 1.0)).scale_by(.5);
                            } else {
                                hit_data.color.copy(obj.color);
                            }
                            break;
                        case SHADING_METHODS.STEP_COUNT:
                            hit_data.kind = HIT_KINDS.STEP_COUNTED;
                            hit_data.step_count = ray.num_steps;
                            break;
                        case SHADING_METHODS.COLOR:
                            hit_data.kind = HIT_KINDS.COLOR;
                            hit_data.color.copy(obj.color);
                            break;
                        default:
                            console.log('UNHANDLED SHADING TYPE');
                            break;
                    }
                }
                dp *= RMSETTINGS.OUTPUT_BUFFER_SIZE;
                hit_data.serialize(this.output_buffer, dp);
                // March ray
            }
            counter++;
        }
        //let a = Atomics.add(this.shared_counters, request_id, counter);
        //console.log("A at", a);
        //console.log('WORKER REPORTING DONE...', this.worker_num);
        this.complete_work(request_id, 1)
    }

    // Reconstruct a scene from data which was copied
    setup_scene(from) {
        this.scene.setup_from(from);
    }

    // Reconstruct a full cam object from data which was copied
    setup_cam(from) {
        this.cam.setup_from(from);
    }
}

let worker = null;

/**
 *
 * @param e
 */
onmessage = function(e) {
    //console.log('Thread message', e);
    e = e.data;
    if (e.kind === 'setup scene') {
        //console.log('SETTING UP WITH', e);
        worker = new raymarching_worker_t(e.worker_num, e.scene, e.cam, e.settings, e.output_buffer, e.shared_counters, e.request_id);
    } else {
        worker.march(e.x_start, e.x_end, e.y_start, e.y_end, e.request_id);
    }
}