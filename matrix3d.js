"use strict";

function matrix_multiply(A, B, C) {
    C[0] = A[0]*B[0] + A[1]*B[4] + A[2]*B[8];
    C[1] = A[0]*B[1] + A[1]*B[5] + A[2]*B[9];
    C[2] = A[0]*B[2] + A[1]*B[6] + A[2]*B[10];
    C[3] = A[0]*B[3] + A[1]*B[7] + A[2]*B[11] + A[3];

    C[4] = A[4]*B[0] + A[5]*B[4] + A[6]*B[8];
    C[5] = A[4]*B[1] + A[5]*B[5] + A[6]*B[9];
    C[6] = A[4]*B[2] + A[5]*B[6] + A[6]*B[10];
    C[7] = A[4]*B[3] + A[5]*B[7] + A[6]*B[11] + A[7];

    C[8] = A[8]*B[0] + A[9]*B[4] + A[10]*B[8];
    C[9] = A[8]*B[1] + A[9]*B[5] + A[10]*B[9];
    C[10] = A[8]*B[2] + A[9]*B[6] + A[10]*B[10];
    C[11] = A[8]*B[3] + A[9]*B[7] + A[10]*B[11] + A[11];

}

let world_up = new vec3(0, 1, 0);

class matrix3d {
    constructor(copy_from=null) {
        if (copy_from === null)
            this.D = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        else
            this.D = [copy_from.D[0], copy_from.D[1], copy_from.D[2],
            copy_from.D[3], copy_from.D[4], copy_from.D[5],
            copy_from.D[6], copy_from.D[7], copy_from.D[8],
            copy_from.D[9], copy_from.D[10], copy_from.D[11]];
    }

    // Create a 3D rotation matrix around any axis as specified by a vec3 axis
    /**
     *
     * @param {vec3} axis
     * @param {Number }angle
     */
    axis_angle(axis, angle) {
        let ax = new vec3(axis).normalize();
        if (ax.magnitude() < .000001)
            return null;

        let c=Math.cos(angle);
        let s=Math.sin(angle);
        let t=1-c;
        let D = this.D;

        D[0] = t*ax.x*ax.x + c;
        D[1] = t*ax.x*ax.y - s*ax.z;
        D[2] = t*ax.x*ax.z + s*ax.y;
        D[3] = 0;

        D[4] = t*ax.x*ax.y + s*ax.z;
        D[5] = t*ax.y*ax.y + c;
        D[6] = t*ax.y*ax.z - s*ax.x;
        D[7] = 0;

        D[8] = t*ax.x*ax.z - s*ax.y;
        D[9] = t*ax.y*ax.z + s*ax.x;
        D[10] = t*ax.z*ax.z + c;
        D[11] = 0;
        return this;
    }


    to_vectors(pos_out, rotation_out) {
        pos_out.set(-this.D[3], -this.D[7], -this.D[11]);
        rotation_out.set(this.D[8], this.D[9], this.D[10]);
    }

    multiply_by(B) {
        let A = this.D;``
        this.D = new Array(12);
        matrix_multiply(A, B, this.D);
        return this;
    }

    multiply_2(A, B) {
        matrix_multiply(A.D, B.D, this.D);
        return this;
    }

    rotate_x_fill(x_angle) {
        let cx = Math.cos(x_angle);
        let sx = Math.sin(x_angle);
        let D = this.D;
        D[0]=1; D[1]=0; D[2]=0; D[3]=0;
        D[4]=0; D[5]=cx; D[6]=-sx; D[7]=0;
        D[8]=0; D[9]=sx; D[10]=cx; D[11]=0;
        return this;
    }

    rotate_y_fill(y_angle) {
        let cy = Math.cos(y_angle);
        let sy = Math.sin(y_angle);
        let D = this.D;
        D[0]=cy; D[1]=0; D[2]=sy; D[3]=0;
        D[4]=0; D[5]=1; D[6]=0; D[7]=0;
        D[8]=-sy; D[9]=0; D[10]=cy; D[11]=0;
        return this;

    }

    rotate_z_fill(z_angle) {
        let cz = Math.cos(z_angle);
        let sz = Math.sin(z_angle);
        let D = this.D;
        D[0]=cz; D[1]=-sz; D[2]=0; D[3]=0;
        D[4]=sz; D[5]=cz; D[6]=0; D[7]=0;
        D[8]=0; D[9]=0; D[10]=1; D[11]=0;
        return this;
    }

    plog() {
        let D = this.D;
        console.log(D[0] + ' ' + D[1] + ' ' + D[2] + ' ' + D[3]);
        console.log(D[4] + ' ' + D[5] + ' ' + D[6] + ' ' + D[7]);
        console.log(D[8] + ' ' + D[9] + ' ' + D[10] + ' ' + D[11]);
    }

    // Create a camera
    create_pov(origin, angle) {
        let transf = new matrix3d().transform_fill(-origin.x, -origin.y, -origin.z);
        let rotate = new matrix3d().rotate_fill(angle.x, angle.y, angle.z);
        matrix_multiply(rotate.D, transf.D, this.D);
        return this;
    }

    // Create a matrix as if you're at origin looking at target
    /**
     *
     * @param {vec3} origin
     * @param {vec3} target
     */
    create_look_at(origin, target) {
        // Calculate and normalize view vector
        let view_out = new vec3(target.x - origin.x, target.y - origin.y, target.z - origin.z);
        let view_magnitude = view_out.magnitude();
        view_out.normalize_t(view_magnitude);

        let up_projection = view_out.x*world_up.x + view_out.y*world_up.y + view_out.z*world_up.z;

        // First try using world up
        let view_up = new vec3(world_up.x - up_projection*view_out.x, world_up.y - up_projection*view_out.y, world_up.z - up_projection*view_out.z);
        let up_magnitude = view_up.magnitude();
        if (up_magnitude < .000001) {
            // Try using Y axis default
            view_up.x = -view_out.y * view_out.x;
            view_up.y = 1-view_out.y*view_out.y;
            view_up.z = -view_out.y*view_out.z;
            up_magnitude = view_up.magnitude();
            if (up_magnitude < .000001) {
                // Try using Z axis
                view_up.x = -view_out.z * view_out.x;
                view_up.y = -view_out.z * view_out.y;
                view_up.z = 1-view_out.z * view_out.z;

                up_magnitude = view_up.magnitude();
                if (up_magnitude < .000001) {
                    return false;
                }
            }
        }

        // Normalize
        view_up.normalize_t(up_magnitude);

        // Cross product of Out and Up makes Right vector
        let view_right = new vec3(-view_out.y*view_up.z + view_out.z*view_up.y,
                                  -view_out.z*view_up.x + view_out.x*view_up.z,
                                     -view_out.x * view_up.y + view_out.y * view_up.x);

        let D = new Array(12);
        D[0] = view_right.x;
        D[1] = view_right.y;
        D[2] = view_right.z;
        D[3] = 0;

        D[4] = view_up.x;
        D[5] = view_up.y;
        D[6] = view_up.z;
        D[7] = 0;

        D[8] = view_out.x;
        D[9] = view_out.y;
        D[10] = view_out.z;
        D[11] = 0;

        let view_move = new matrix3d().transform_fill(-origin.x, -origin.y, -origin.z);
        matrix_multiply(D, view_move.D, this.D);
    }

    // Create a 3d rotation matrix, x*y*z
    rotate_fill(x_angle, y_angle, z_angle) {
        let x = new matrix3d().rotate_x_fill(x_angle);
        let y = new matrix3d().rotate_y_fill(y_angle);
        let z = new matrix3d().rotate_z_fill(z_angle);

        let tmp = new matrix3d().multiply_2(z,y);
        this.multiply_2(tmp, x);
        return this;
    }

    transform_fill(x, y, z) {
        let D = this.D;
        D[0]=1; D[1]=0; D[2]=0; D[3]=x;
        D[4]=0; D[5]=1; D[6]=0; D[7]=y;
        D[8]=0; D[9]=0; D[10]=1; D[11]=z;
        return this;
    }

}