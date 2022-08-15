"use strict";

class raycamera {
    constructor() {
        this.pos = new vec3(0, 0, 0);
        this.angle = new vec3(0, 0, 0);

        this.aspect_ratio = 1.0;
        this.viewport_height = 2.0;
        this.viewport_width = 0;
        this.fov = 90;
        this.focal_length = 1.0;
        this.view_vectors = [];
        this.zoom = 1.0;
    }

    setup_viewport(x_res, y_res, horizontal_fov) {
        this.aspect_ratio = (x_res / y_res);
        this.viewport_height = 2 / this.zoom;
        this.viewport_width = this.aspect_ratio * this.viewport_height;
        this.x_res = x_res;
        this.y_res = y_res;
        this.fov = horizontal_fov;
        this.view_vectors = new Array(x_res * y_res);
    }

    generate_vectors() {
        let horizontal = new vec3(this.viewport_width, 0, 0);
        let vertical = new vec3(0, this.viewport_height, 0);
        let lower_left_corner = new vec3( -(horizontal.x * .5), -(vertical.y * .5), -this.focal_length);
        let nega = new vec3(-this.angle.x, -this.angle.y, -this.angle.z);
        let matrix = new matrix3d().create_pov(new vec3(0, 0, 0), nega);
        matrix.plog();
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
                //console.log('BEFORE', mvec.x, mvec.y, mvec.z);
                mvec.normalize();
                mvec.apply_matrix(matrix);
                //console.log('AFTER', mvec.x, mvec.y, mvec.z);
                this.view_vectors[(y*this.x_res) + x] = mvec;
            }
        }
    }
}
