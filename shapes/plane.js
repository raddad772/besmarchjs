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
        this.ref_name = "plane";

        this.has_surface_normal = false;
        this.has_surface_shader = false;
        this.shade_based_on_steps = true;
        this.hit_sub_zero = false;
        this.shading_method = SHADING_METHODS.COLOR;


        this.kind = OBJ_KINDS.PLANE;
    }

    surface_shade(scene, ray, cam) {
    }

    dist_func(from) {
        let d = Math.abs((this.a * from.x + this.b * from.y +
            this.c * from.z + this.d));
        let e = Math.sqrt(this.a * this.a + this.b *
            this.b + this.c * this.c);
        return d / e;
    }

    surface_normal() {
        //return this.gradient.normalize();
    }
}
