"use strict";

const NMAX = 0x7FFFFFFFF

class vec3 {
    constructor(x=null, y=null, z=null) {
        if ((x === null) && (y === null) && (z === null)) {
            this.x = 0;
            this.y = 0;
            this.z = 0
        } else if ((y === null) && (z === null)) {
            if (typeof(x) === 'number') {
                this.x = x;
                this.y = x;
                this.z = x;
            }
            else {
                this.x = x.x;
                this.y = x.y;
                this.z = x.z;
            }
        }
        else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(vec) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    }

    subtract(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    distance(vec) {
        let dx = this.x - vec.x;
        let dy = this.y - vec.y;
        let dz = this.z - vec.z;
        return Math.sqrt((dx*dx) + (dy*dy) + (dz*dz));
    }

    multiply_by(vec) {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        return this;
    }

    scale_by(t) {
        this.x *= t;
        this.y *= t;
        this.z *= t;
        return this;
    }

    scale_ret(t) {
        return new vec3(this.x * t, this.y * t, this.z * t);
    }

    multiply_ret(vec) {
        return new vec3(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    abself() {
        this.x = Math.abs(this.x);
        this.y = Math.abs(this.y);
        this.z = Math.abs(this.z);
        return this;
    }

    copy(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    magnitude() {
        return Math.sqrt((this.x*this.x) + (this.y*this.y) + (this.z*this.z));
    }

    normalize_1() {
        let ratio = Math.max(this.x, this.y, this.z);
        this.x /= ratio;
        this.y /= ratio;
        this.z /= ratio;
        return this;
    }

    normalize() {
        let length = this.magnitude();
        this.x /= length;
        this.y /= length;
        this.z /= length;
        return this;
    }
}

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

class mandelbulb_t {
    constructor() {
        this.distance = 0;
        this.ref_name = "fractal";
        this.color = new vec3(1.0, 1.0, 1.0);

        this.has_surface_normal = false;
        this.has_surface_shader = false;

        //this.pos = new vec3(0, 0, 0);

        this.bailout = 5000000;
        this.iterations = 1000;
        this.power = 8;
    }

    dist_func(from) {
        let z = new vec3(from);
        let dr = 1.0;
        let r = 0.0;
        for (let i = 0; i < this.iterations ; i++) {
            r = z.magnitude();
            if (r>this.bailout) {
                break;
            }

            // convert to polar coordinates
            let theta = Math.acos(z.z/r);
            let phi = Math.atan(z.y, z.x);
            dr =  Math.pow( r, this.power-1.0)*this.power*dr + 1.0;

            // scale and rotate the point
            let zr = Math.pow(r, this.power);
            theta *= this.power;
            phi *= this.power;

            // convert back to cartesian coordinates
            z = new vec3(Math.sin(theta)*Math.cos(phi), Math.sin(phi)*Math.sin(theta), Math.cos(theta)).scale_by(zr).add(from);
            //z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
            //z+=pos;
        }
        let f = 0.5*Math.log(r)*r/dr;
        //console.log(f);
        return f;
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

class camera {
    constructor() {
        this.pos = new vec3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0;

        this.aspect_ratio = 1.0;
        this.viewport_height = 2.0;
        this.viewport_width = 0;
        this.fov = 90;
        this.focal_length = 1.0;
    }

    setup_viewport(x_res, y_res, horizontal_fov) {
        this.aspect_ratio = (x_res / y_res);
        this.viewport_height = 2;
        this.viewport_width = this.aspect_ratio * this.viewport_height;
        this.x_res = x_res;
        this.y_res = y_res;
        this.fov = horizontal_fov;
    }

    generate_vectors(buf) {
        let horizontal = new vec3(this.viewport_width, 0, 0);
        let vertical = new vec3(0, this.viewport_height, 0);
        let lower_left_corner = new vec3(this.pos.x - (horizontal.x * .5), this.pos.y - (vertical.y * .5), this.pos.z - this.focal_length);
        for (let y=this.y_res-1; y >= 0; y--) {
            console.log('On scanline', y);
            for (let x = this.x_res - 1; x >= 0; x--) {
                let u = x / (this.x_res-1);
                let v = y / (this.y_res-1);
                let uvec = horizontal.scale_ret(u);
                let vvec = vertical.scale_ret(v);
                let mvec = new vec3(lower_left_corner);
                mvec.add(uvec);
                mvec.add(vvec);
                mvec.subtract(this.pos);
                mvec.normalize();
                buf[(y*this.x_res) + x] = mvec;
            }
        }
    }
}

var canvas;
const XRES=320;
const YRES=240;
const pi = Math.PI;

const DIST_FOR_HIT = .0001

function render_tests(imgdata) {
    // 90 degrees (0) is at pi/2
    // 180 degrees (+1) at pi
    // 270 degrees (-1) at pi * (3/2)

    // complete circle in 2 pi
    let angle = 270;
    let degrees_to_radians = function(degrees) { return (degrees / 180) * pi };


    let cam = new camera();
    cam.pos.set(0, 0, 2)
    let vecs = new Array(XRES * YRES);
    cam.setup_viewport(XRES, YRES, 90);
    console.log('Setting up rays')
    cam.generate_vectors(vecs);
    console.log('Setting up scene')
    let scene = new scene_t();
    let sphere = new sphere_t();
    let light = new light_t();
    light.pos.set(-0.5, -10.0, 0.0)
    sphere.pos.set(-2, 0, -2);
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
                let t = (0.5*vecs[dp/4].y) + 1.0;
                color.set(1.0-t, 1.0-t, 1.0-t);
                color.add(new vec3(0.5, 0.7, 1.0).scale_by(t));
                color.normalize_1();
                // Add a glow if we came close
                let glow = (ray.num_steps / 100);
                if (glow > 1) glow = 1;
                glow = glow > .2 ? (1.0 * glow) : 0;
                color.add(new vec3(glow, 0, 0));
                color.normalize_1();
            }
            else {
                let obj = scene.min_was;
                if (obj.has_surface_normal) {
                    if (obj.has_surface_shader) {
                        color = obj.surface_shade(scene, ray, cam);
                    }
                    else if (obj.has_surface_normal) {
                        color.copy(obj.surface_normal(ray.pos)).abself().add(new vec3(1.0, 1.0, 1.0)).scale_by(.5);
                    }
                    else {
                        color.copy(obj.color);
                    }
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