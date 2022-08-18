const clip = (num, min, max) => Math.min(Math.max(num, min), max);

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

    clipself(min, max) {
        this.x = clip(this.x, min.x, max.x);
        this.y = clip(this.y, min.y, max.y);
        this.z = clip(this.z, min.z, max.z);
        return this;
    }

    negself() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }

    maxself(what) {
        this.x = Math.max(this.x, what);
        this.y = Math.max(this.y, what);
        this.z = Math.max(this.z, what);
        return this;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
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

    mod_new(val) {
        //let r = new vec3(this.x, this.y, this.z).normalize()
        return new vec3(this.x, this.y, this.z).normalize().scale_by(this.magnitude() % val);
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

    normalize_for_color() {
        let rx = Math.abs(this.x);
        let ry = Math.abs(this.y);
        let rz = Math.abs(this.z);
        let max = Math.max(Math.max(rx, ry), rz);
        this.x = rx / max;
        this.y = ry / max;
        this.z = rz / max;
        return this;
    }

    normalize_1() {
        let ratio = Math.max(Math.max(this.x, this.y), this.z);
        this.x /= ratio;
        this.y /= ratio;
        this.z /= ratio;
        return this;
    }

    normalize() {
        let length = this.magnitude();
        if (length === 0) return this;
        this.x /= length;
        this.y /= length;
        this.z /= length;
        return this;
    }

    normalize_t(t) {
        this.x /= t;
        this.y /= y;
        this.z /= t;
        return this;
    }

    apply_matrix(matrix) {
        let D = matrix.D;
        let x = this.x;
        let y = this.y;
        let z = this.z;
        this.x = x*D[0] + y*D[1] + z*D[2] + D[3];
        this.y = x*D[4] + y*D[5] + z*D[6] + D[7];
        this.z = x*D[8] + y*D[9] + z*D[10] + D[11];
        return this;
    }

    serialize(buf, pos) {
        let outbuf = new ArrayBuffer(24);
        let obuf = new Float64Array(outbuf);
        obuf[0] = this.x;
        obuf[1] = this.y;
        obuf[2] = this.z;
        let dbuf = new Uint8Array(outbuf);
        for (let i = 0; i < 24; i++) {
            buf[pos+i] = dbuf[i];
        }
    }

    deserialize(buf, pos) {
        let inbuf = new ArrayBuffer(24);
        let ibuf = new Float64Array(inbuf);
        let dbuf = new Uint8Array(inbuf);
        for (let i = 0; i < 24; i++) {
            dbuf[i] = buf[pos+i];
        }
        this.x = ibuf[0];
        this.y = ibuf[1];
        this.z = ibuf[2];
    }
}
