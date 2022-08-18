"use strict";

const NMAX = 0x7FFFFFFFF;

const SHADING_METHODS = {
    COLOR: 0,
    SURFACE_NORMAL: 1,
    SHADED: 2,
    STEP_COUNT: 3
}

const HIT_KINDS = {
    MISS: 0,
    COLOR: 1,
    NORMAL: 2,
    STEP_COUNTED: 3
}

const OBJ_KINDS = {
    SPHERE: 0,
    MANDELBULB: 1,
    PLANE: 2,
    OBJ2: 3,
    BOX: 4,
}

class light_t {
    constructor(pos=null, strength=null) {
        if (pos === null) this.pos = new vec3();
        else this.pos = new vec3(pos.x, pos.y, pos.z);

        this.strength = strength;
    }
}

class hit_t {
    constructor() {
        this.kind = HIT_KINDS.MISS;
        this.color = new vec3();
        this.step_count = 0;
    }

    serialize_step_count(buffer, pos) {
        let outbuf = new ArrayBuffer(4);
        let obuf = new Int32Array(outbuf);
        let dbuf = new Uint8Array(outbuf);

        obuf[0] = this.step_count;
        for (let i = 0; i < 4; i++) {
            buffer[pos+i] = dbuf[i];
        }
    }

    deserialize_step_count(buffer, pos) {
        let inbuf = new ArrayBuffer(4);
        let ibuf = new Int32Array(inbuf);
        let dbuf = new Uint8Array(inbuf);

        for (let i = 0; i < 4; i++) {
            dbuf[i] = buffer[pos+i];
        }
        this.step_count = ibuf[0];
    }

    serialize(buffer, place) {
        buffer[place] = this.kind;
        switch(this.kind) {
            case HIT_KINDS.COLOR:
            case HIT_KINDS.NORMAL:
                this.color.serialize(buffer, place+1);
                break;
            case HIT_KINDS.MISS:
            case HIT_KINDS.STEP_COUNTED:
                this.serialize_step_count(buffer, place+1);
                break;
        }
    }

    deserialize(buffer, place) {
        this.kind = buffer[place];
        switch(this.kind) {
            case HIT_KINDS.MISS:
                break;
            case HIT_KINDS.COLOR:
            case HIT_KINDS.NORMAL:
                this.color.deserialize(buffer, place+1);
                break;
            case HIT_KINDS.STEP_COUNTED:
                this.deserialize_step_count(buffer, place+1);
                break;
        }
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
        this.bounding_sphere.radius = 40.0;
    }

    setup_from(from) {
        this.objects = [];
        let lights = [];
        this.bounding_sphere = new sphere_t(from.bounding_sphere);
        for (let i in from.objects) {
            let obj = from.objects[i];
            let mobj = dupe_obj(obj);
            //console.log(obj);
            this.objects.push(mobj);
        }

        for (let i in from.lights) {
            let light = from.lights[i];
            let mlight = new light_t(light.pos, light.strength);
            lights.push(mlight);
        }
        this.lights = lights;
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
