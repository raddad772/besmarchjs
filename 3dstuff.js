"use strict";

const NMAX = 0x7FFFFFFFF
const BKG_SKY = true
const DO_GLOW = false;
const GLOW_COLOR = new vec3(1, 1, 0);

function dot3(vec1, vec2) {
    return (vec1.x*vec2.x) + (vec1.y*vec2.y) + (vec1.z*vec2.z);
}

class ray_t {
    constructor(origin=null, dir=null) {
        if (origin !== null) this.origin = new vec3(origin);
        else this.origin = new vec3();
        if (dir !== null) this.dir = new vec3(dir);
        else this.dir = new vec3();
        this.pos = new vec3(this.origin);
        this.num_steps = 0;
    }

    at(t=null) {
        if (t === null) t = this.t;
        let r = new vec3(this.dir);
        r.scale_by(t);
        r.add(this.origin)
        return r;
    }
}

class scene_t {
    constructor() {
        this.objects = [];
        this.lights = [];
        this.min_was = null;
        this.bounding_sphere = new sphere_t();
        this.bounding_sphere.pos.set(0, 0, 0);
        this.bounding_sphere.radius = 20.0;
    }

    add_object(obj) {
        this.objects.push(obj);
    }

    add_light(light) {
        this.lights.push(light);
    }

    min_distance(where) {
        let min = NMAX;
        for (let i in this.objects) {
            let obj = this.objects[i];
            let d = obj.dist_func(where);
            if (d < min) {
                min = d;
                this.min_was = this.objects[i];
            }
        }
        return min;
    }
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

const MAX_MARCHES = 100000

var canvas;
const XRES=900;
const YRES=600;
const pi = Math.PI;

const DIST_FOR_HIT = .00005;

const ui_el = {
    dist_for_hit_input: ['distforhit', DIST_FOR_HIT],
}

function render_tests(imgdata) {
    // 90 degrees (0) is at pi/2
    // 180 degrees (+1) at pi
    // 270 degrees (-1) at pi * (3/2)

    // complete circle in 2 pi
    let angle = 270;
    let degrees_to_radians = function(degrees) { return (degrees / 180) * pi };


    let cam = new camera();
    cam.pos.set(1, 0, 1.5)
    let roto = degrees_to_radians(-30);
    cam.angle.set(0, roto, 0);
    let vecs = new Array(XRES * YRES);
    cam.setup_viewport(XRES, YRES, 90);
    console.log('Setting up rays')
    cam.generate_vectors(vecs);
    console.log('Setting up scene')
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
    let color = new vec3();
    console.log('Marching rays');
    for (let y = 0; y<YRES; y++) {
        console.log('On Y', y);
        for (let x = 0; x<XRES; x++) {
            let dp = (y*XRES)+x;
            let ray = new ray_t(cam.pos, vecs[dp]);
            dp *= 4;
            let hit = false;
            let oob = new vec3();
            for (ray.num_steps = 0; ray.num_steps < MAX_MARCHES; ray.num_steps++) {
                let dist = scene.min_distance(ray.pos);
                ray.pos.add(new vec3(ray.dir).scale_by(dist));
                if (dist <= DIST_FOR_HIT) {
                    hit = true;
                    break;
                }
                if (oob.copy(ray.pos).subtract(scene.bounding_sphere.pos).magnitude() > scene.bounding_sphere.radius) break;
            }
            if (!hit) {
                if (BKG_SKY) {
                    let t = (0.5 * vecs[dp / 4].y) + 1.0;
                    color.set(1.0 - t, 1.0 - t, 1.0 - t);
                    color.add(new vec3(0.5, 0.7, 1.0).scale_by(t));
                    color.normalize_1();
                    // Add a glow if we came close
                    if (DO_GLOW) {
                        let glow = (ray.num_steps / 100);
                        if (glow > 1) glow = 1;
                        glow = glow > .2 ? (1.0 * glow) : 0;
                        color.add(new vec3(GLOW_COLOR.x, GLOW_COLOR.y, GLOW_COLOR.z).scale_by(glow));
                    }
                    color.normalize_1();
                } else {
                    color.set(0, 0, 0);
                }
            }
            else {
                let obj = scene.min_was;
                if (obj.has_surface_shader) {
                    color = obj.surface_shade(scene, ray, cam)
                } else if (obj.has_surface_normal) {
                    color.copy(obj.surface_normal(ray.pos)).abself().add(new vec3(1.0, 1.0, 1.0)).scale_by(.5);
                } else {
                    color.copy(obj.color);
                }
            }

            imgdata[dp] = (color.x * 255) >> 0;
            imgdata[dp+1] = (color.y * 255) >> 0;
            imgdata[dp+2] = (color.z * 255) >> 0;
            imgdata[dp+3] = 255;

            // March ray
        }
    }
}

function main() {
    canvas = document.getElementById('drawhere');
    let ctx = canvas.getContext('2d');
    let imgdata = ctx.getImageData(0, 0, XRES, YRES);
    render_tests(imgdata.data);
    console.log('PUTTING IMAGE DATA...');
    console.log('CANVAS!', canvas);
    ctx.putImageData(imgdata, 0, 0);
    console.log('PUT!');
}


window.onload = main;