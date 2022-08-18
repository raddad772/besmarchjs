function dupe_obj(obj) {
    if (obj === null) return obj;
    let mobj;
    switch (obj.kind) {
        case OBJ_KINDS.SPHERE:
            mobj = new sphere_t(obj);
            break;
        case OBJ_KINDS.MANDELBULB:
            mobj = new mandelbulb_t(obj);
            break;
        case OBJ_KINDS.PLANE:
            mobj = new plane_t(obj);
            break;
        case OBJ_KINDS.OBJ2:
            mobj = new obj2_t(obj);
            break;
        case OBJ_KINDS.BOX:
            mobj = new box_t(obj);
            break;
        default:
            console.log('UNKNOWN KIND', obj.kind);
            break;
    }
    return mobj;
}

class obj_props_t {
    constructor(has_surface_normal=false, has_surface_shader=false, hit_sub_zero=false, shading_method=SHADING_METHODS.COLOR, hit_only_sub_zero=false) {
        this.has_surface_normal = has_surface_normal;
        this.has_surface_shader = has_surface_shader;
        this.hit_sub_zero = hit_sub_zero;
        this.shading_method = shading_method;
        this.hit_only_sub_zero = hit_only_sub_zero;
    }
}

class box_t {
    constructor(old=null) {
        if (old === null) {
            this.s = new vec3(1, 1, 1);
            this.c = new vec3(0, 0, 0);
            this.color = new vec3(1, 1, 1);
        }
        else {
            this.s = new vec3(old.s);
            this.c = new vec3(old.c);
            this.color = new vec3(old.color);
        }
        this.kind = OBJ_KINDS.BOX;
        this.ref_name = "box";

        this.props = new obj_props_t(true, true, true, SHADING_METHODS.SHADED, false);

        /*
	def DE(self, p):
		c = get_global(self.c)
		s = get_global(self.s)
		a = np.abs(p[:3] - c) - s;
		return (min(max(a[0], a[1], a[2]), 0.0) + np.linalg.norm(np.maximum(a,0.0))) / p[3]

	def NP(self, p):
		c = get_global(self.c)
		s = get_global(self.s)
		return np.clip(p[:3] - c, -s, s) + c

         */
    }

    dist_func(p) {
       let a = new vec3(p).subtract(this.c).abself().subtract(this.s);
       return (Math.min(Math.max(a.x, a.y, a.z), 0.0) + new vec3(a).maxself(0).magnitude());
    }

    surface_normal(where) {
        return new vec3(where).subtract(this.c).clipself(new vec3(this.s).negself(), this.s).add(this.c);
    }

    surface_shade(scene, ray, cam) {
        let light = new vec3(scene.lights[0].pos).subtract(ray.pos).normalize();
        let dp = dot3(light, this.surface_normal(ray.pos));
        if (dp < 0) dp = 0;
        return new vec3(dp*this.color.x, dp*this.color.y, dp*this.color.z);
    }
}

class obj2_t {
    constructor(old = null) {
        if (old === null) {
            this.obj1 = null;
            this.obj2 = null;
            this.color = new vec3(1.0, 0.5, 1.0);
        }
        else {
            this.obj1 = dupe_obj(old.obj1);
            this.obj2 = dupe_obj(old.obj2);
            this.color = new vec3(old.color.x, old.color.y, old.color.z);
        }
        this.kind = OBJ_KINDS.OBJ2;
        this.ref_name = "obj2";

        this.props = new obj_props_t(false, true, true, SHADING_METHODS.SHADED, true);
    }

    dist_func(from) {
        let d1 = this.obj1.dist_func(from);
        let d2 = this.obj2.dist_func(from);
        //return d1 - d2;
        //return d2 + d1;
        //return d2 * d1;
        //return d2 / d1;
        //return d1 < d2 ? d2 : d1 - d2;
        //return Math.min(d1, d2);
        return Math.max(d1, d2);
    }

    surface_shade(scene, ray, cam) {
        let d1 = this.obj1.dist_func(ray.pos);
        let d2 = this.obj2.dist_func(ray.pos);
        let obj = d1 > d2 ? this.obj1 : this.obj2;
        return obj.surface_shade(scene, ray, cam);
    }
}

class plane_t {
    constructor(old=null) {
        if (old === null) {
            this.a = 0;
            this.b = 0;
            this.c = 0;
            this.d = 0;
            this.color = new vec3(1.0, 1.0, 1.0);
        }
        else {
            this.a = old.a;
            this.b = old.b;
            this.c = old.c;
            this.d = old.d;
            this.color = new vec3(old.color);
        }
        this.kind = OBJ_KINDS.PLANE;
        this.ref_name = "plane";

        this.props = new obj_props_t(false, false, true, SHADING_METHODS.COLOR, false);

    }

    surface_shade(scene, ray, cam) {
    }

    dist_func(from) {
        let d = Math.abs((this.a * from.x + this.b * from.y +
            this.c * from.z + this.d));
        let e = Math.sqrt(this.a * this.a + this.b *
            this.b + this.c * this.c);
        //console.log(d, e);
        return d / e;
    }

    surface_normal() {
        //return this.gradient.normalize();
    }
}

class sphere_t {
    constructor(old = null) {
        if (old === null) {
            // A valid ray-marching object has these two important things:
            // a distance function,
            // and a member to store the current distance.
            this.distance = 0;
            this.ref_name = "hello sphere";
            this.color = new vec3(0, 0.5, 0.75);
            this.pos = new vec3();
            this.radius = 1.0;
        }
        else {
            this.distance = old.distance;
            this.ref_name = old.ref_name;
            this.color = new vec3(old.color.x, old.color.y, old.color.z);
            this.pos = new vec3(old.pos.x, old.pos.y, old.pos.z);
            this.radius = old.radius;
        }
        this.kind = OBJ_KINDS.SPHERE;
        this.props = new obj_props_t(true, true, true, SHADING_METHODS.COLOR, false);
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
        let sd = (this.pos.distance(what) - this.radius);
        return sd;
    }
}
