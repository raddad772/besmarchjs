MANDELBULB_DO_SPHERE = false;

class mandelbulb_t {
    constructor() {
        this.distance = 0;
        this.ref_name = "fractal";
        this.color = new vec3(1.0, 1.0, 1.0);
        this.sphere = new sphere_t();
        this.sphere.pos.set(.1, 0, 0);
        this.sphere.radius = .95;

        this.has_surface_normal = true;
        this.has_surface_shader = false;
        this.shade_based_on_steps = true;

        //this.pos = new vec3(0, 0, 0);

        this.bailout = 10;
        this.iterations = 100;
        this.power = 8;
        this.gradient = new vec3();
    }

    surface_shade(scene, ray, cam) {
        /*let light = new vec3(scene.lights[0].pos).subtract(ray.pos).normalize();
        let dp = dot3(light, this.surface_normal());
        if (dp < 0) dp = 0;
        return new vec3(dp*this.color.x, dp*this.color.y, dp*this.color.z);*/


        /*
        let scaler = ray.num_steps / 100;
        let color = new vec3();
        color.set(1.0, 1.0, 1.0).scale_by(scaler);
        //color.normalize();
        color.set(1-color.x, 1-color.y, 1-color.z);
        return color;*/

        //return this.gradient.normalize_for_color();
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
        this.gradient.copy(z).subtract(from);
        //console.log(r/dr);
        let f = 0.5*Math.log(r)*r/dr;
        //console.log(f);
        if (MANDELBULB_DO_SPHERE) {
            let f2 = this.sphere.dist_func(from);
            //very interesting .75-1.1
            //return f2 - f;

            // hmm
            /* let f3 = Math.max(f, f2);
            f /= f3;
            f2 /= f3;
            return f * f2;*/

            // interesting around .55
            //return f * f2;

            return f2 - f;
            //return Math.min(f, this.sphere.dist_func(from));
        }
        else {
            return f;
        }
    }

    surface_normal() {
        return this.gradient.normalize();
    }
}
