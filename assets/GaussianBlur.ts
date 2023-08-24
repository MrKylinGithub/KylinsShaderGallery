import { _decorator, gfx, postProcess, Material, EffectAsset, renderer, rendering, Vec4, Camera } from 'cc';
const { Format } = gfx

const { ccclass, property, menu } = _decorator;

@ccclass('GaussianBlur')
@menu('PostProcess/GaussianBlur')
export class GaussianBlur extends postProcess.PostProcessSetting {

    @property(EffectAsset)
    _effectAsset: EffectAsset | undefined

    @property(EffectAsset)
    get effect() {
        return this._effectAsset;
    }
    set effect(v) {
        this._effectAsset = v;
        if (this._effectAsset == null) {
            this._material = null;
        }
        else {
            if (this._material == null) {
                this._material = new Material();
            }
            this._material.reset({ effectAsset: this._effectAsset });
        }
        this.updateMaterial();
    }

    @property
    iterations = 3;

    @property
    get blurRadius() {
        return this._blurParams.x;
    }
    set blurRadius(v) {
        this._blurParams.x = v;
        this.updateMaterial();
    }


    private _material: Material;
    public get material(): Material {
        return this._material;
    }

    @property
    private _blurParams: Vec4 = new Vec4(1.0, 0.0, 0.0, 0.0);
    public get blurParams(): Vec4 {
        return this._blurParams;
    }

    updateMaterial() {
        if (!this._material) {
            return;
        }
        this._material.setProperty('blurParams', this.blurParams);
    }

    protected start(): void {
        if (this._effectAsset) {
            this._material = new Material();
            this._material.initialize({ effectAsset: this._effectAsset });
            this._material.setProperty('blurParams', this.blurParams);
        }
    }
}

export class GaussianBlurPass extends postProcess.SettingPass {
    get setting() { return this.getSetting(GaussianBlur); }

    checkEnable(camera: renderer.scene.Camera) {
        let enable = super.checkEnable(camera);
        if (postProcess.disablePostProcessForDebugView()) {
            enable = false;
        }
        return enable && this.setting.material != null;
    }

    name = 'GaussianBlurPass';
    outputNames = ['GaussianBlurMap'];

    private getDepthMap(camera: renderer.scene.Camera) {
        let forwardPass = builder.getPass(postProcess.ForwardPass);
        return forwardPass.slotName(camera, 1);
    }

    public render(camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        const setting = this.setting;
        if (!setting.material) {
            return;
        }

        let passContext = this.context;
        passContext.material = setting.material;

        const cameraID = this.getCameraUniqueID(camera);
        const cameraName = `Camera${cameraID}`;
        const passViewport = passContext.passViewport;

        passContext.clearBlack();
        const format = Format.RGBA8;

        let showDepth = true;
        if(showDepth){
            let input = this.getDepthMap(camera);
            passContext
                .updatePassViewPort()
                .addRenderPass(`blur-y`, `blur-y${cameraID}`)
                .setPassInput(input, 'outputResultMap')
                .addRasterView(this.slotName(camera), format)
                .blitScreen(1)
                .version();
            return;
        }

        let input = this.lastPass!.slotName(camera, 0);
        for (let i = 0; i < setting.iterations; ++i) {
            passContext
                .updatePassViewPort()
                .addRenderPass(`blur-x`, `blur-x${cameraID}`)
                .setPassInput(input, 'outputResultMap')
                .addRasterView('GaussianBlurMap_TMP', format)
                .blitScreen(0)
                .version();

            passContext
                .updatePassViewPort()
                .addRenderPass(`blur-y`, `blur-y${cameraID}`)
                .setPassInput('GaussianBlurMap_TMP', 'outputResultMap')
                .addRasterView(this.slotName(camera), format)
                .blitScreen(1)
                .version();
            input = this.slotName(camera);
        }
    }
}

let builder = rendering.getCustomPipeline('Custom') as postProcess.PostProcessBuilder;
if (builder) {
    builder.insertPass(new GaussianBlurPass(), postProcess.BlitScreenPass);
}
