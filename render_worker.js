/**
 *
 * @param {raymarch_request_t} e
 */

importScripts('raycam.js', 'matrix3d.js', 'vec3.js', 'multithread_support.js')

function onmessage(e) {
    console.log('Marching rays', e.y_start, e.y_end);
    let color = new vec();
    for (let y = e.y_start; y < e.y_end; y++) {
        console.log('On Y', y);
        for (let x = 0; x < e.settings.XRES; x++) {
            let dp = (y * e.settings.XRES) + x;
            let ray = new ray_t(e.settings.cam.pos, vecs[dp]);
            dp *= e.settings.OUTPUT_BUFFER_SIZE;
            let hit_data = new hit_t();
            let hit = false;
            let oob = new vec3();
            for (ray.num_steps = 0; ray.num_steps < e.settings.MAX_MARCHES; ray.num_steps++) {
                let dist = e.scene.min_distance(ray.pos);
                ray.pos.add(new vec3(ray.dir).scale_by(dist));
                hit = false;
                if (e.scene.min_was.hot_sub_zero) {
                    hit = dist <= 0;
                }
                else {
                    hit = dist<= e.settings.DIST_FOR_HIT;
                }
                if (hit) break;
                if (oob.copy(ray.pos).subtract(e.scene.bounding_sphere.pos).magnitude() > e.scene.bounding_sphere.radius) break;
            }
            if (!hit) {
                if (e.settings.BKG_SKY) {
                    let t = (0.5 * e.cam.view_vectors[dp / 4].y) + 1.0;
                    color.set(1.0 - t, 1.0 - t, 1.0 - t);
                    color.add(new vec3(0.5, 0.7, 1.0).scale_by(t));
                    color.normalize_1();
                    // Add a glow if we came close
                    if (e.settings.DO_GLOW) {
                        let glow = (ray.num_steps / 100);
                        if (glow > 1) glow = 1;
                        glow = glow > .2 ? (1.0 * glow) : 0;
                        color.add(new vec3(GLOW_COLOR.x, GLOW_COLOR.y, GLOW_COLOR.z).scale_by(glow));
                    }
                    color.normalize_1();
                } else {
                    color.set(0, 0, 0);
                }
            } else {
                let obj = e.scene.min_was;
                if (obj.has_surface_shader) {
                    color = obj.surface_shade(scene, ray, cam)
                } else if (obj.has_surface_normal) {
                    color.copy(obj.surface_normal(ray.pos)).abself().add(new vec3(1.0, 1.0, 1.0)).scale_by(.5);
                } else {
                    color.copy(obj.color);
                }
            }

            this.imgdata[dp] = (color.x * 255) >> 0;
            this.imgdata[dp + 1] = (color.y * 255) >> 0;
            this.imgdata[dp + 2] = (color.z * 255) >> 0;
            this.imgdata[dp + 3] = 255;

            // March ray
        }
    }
}