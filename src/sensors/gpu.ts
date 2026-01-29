import GLib from "gi://GLib";
import Gio from "gi://Gio";

export class GPUSensor {
  private _gpuType: "nvidia" | "amd_sysfs" | "amd_radeontop" | "none" = "none";
  private _gpuPaths: string[] = [];
  private _errorCount: number = 0;
  private _maxErrors: number = 5;
  private _disabled: boolean = false;

  constructor() {
    this._detectGPUs();
  }

  private _detectGPUs(): void {
    // 1. Check for NVIDIA
    if (GLib.find_program_in_path("nvidia-smi")) {
      this._gpuType = "nvidia";
      return;
    }

    // 2. Check for AMD via sysfs (scanning all cards)
    for (let i = 0; i < 10; i++) {
      const path = `/sys/class/drm/card${i}/device/gpu_busy_percent`;
      if (Gio.File.new_for_path(path).query_exists(null)) {
        this._gpuPaths.push(path);
      }
    }

    if (this._gpuPaths.length > 0) {
      this._gpuType = "amd_sysfs";
      return;
    }

    // 3. Fallback to radeontop
    if (GLib.find_program_in_path("radeontop")) {
      this._gpuType = "amd_radeontop";
      return;
    }

    this._gpuType = "none";
  }

  async getValue(): Promise<number> {
    if (this._disabled || this._gpuType === "none") return 0;

    try {
      let usages: number[] = [];

      switch (this._gpuType) {
        case "nvidia":
          // Queries all GPUs and returns comma-separated percentages
          const proc = Gio.Subprocess.new(
            [
              "nvidia-smi",
              "--query-gpu=utilization.gpu",
              "--format=csv,noheader,nounits",
            ],
            Gio.SubprocessFlags.STDOUT_PIPE,
          );
          const [stdout] = await proc.communicate_utf8_async(null, null);
          usages =
            stdout
              ?.trim()
              .split("\n")
              .map((val) => parseInt(val)) || [];
          break;

        case "amd_sysfs":
          // Manually read each detected card's sysfs file
          for (const path of this._gpuPaths) {
            const usage = await this._readSysfsUsage(path);
            usages.push(usage);
          }
          break;

        case "amd_radeontop":
          // radeontop typically targets one bus; additional logic needed for multi-bus
          return await this._getAmdRadeontopUsage();
      }

      if (usages.length === 0) return 0;
      const sum = usages.reduce((a, b) => a + b, 0);
      return Math.round(sum / usages.length);
    } catch (e) {
      this._handleError(e);
      return 0;
    }
  }

  private async _readSysfsUsage(path: string): Promise<number> {
    try {
      const file = Gio.File.new_for_path(path);
      const [contents] = await file.load_contents_async(null);
      const data = new TextDecoder().decode(contents as unknown as Uint8Array);
      return parseInt(data.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /*private async _getNvidiaUsage(): Promprivate _gpuPaths: string[] = [];ise<number> {
        try {
            const proc = Gio.Subprocess.new(
                ['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            const [stdout] = await proc.communicate_utf8_async(null, null);
            
            const usage = parseInt(stdout?.trim() || '0');
            this._errorCount = 0;
            return isNaN(usage) ? 0 : Math.max(0, Math.min(100, usage));
        } catch (e) {
            this._handleError(e);
            return 0;
        }
    }

    private async _getAmdSysfsUsage(): Promise<number> {
        try {
            const file = Gio.File.new_for_path(this._sysfsPath);
            const [contents] = await file.load_contents_async(null);
            if (!contents) return 0;
            
            const data = new TextDecoder().decode(contents as unknown as Uint8Array);
            const usage = parseInt(data.trim());
            
            this._errorCount = 0;
            return isNaN(usage) ? 0 : Math.max(0, Math.min(100, usage));
        } catch (e) {
            this._handleError(e);
            return 0;
        }
    }*/

  private async _getAmdRadeontopUsage(): Promise<number> {
    try {
      const proc = Gio.Subprocess.new(
        ["radeontop", "-d", "-", "-l", "1"],
        Gio.SubprocessFlags.STDOUT_PIPE,
      );
      const [stdout] = await proc.communicate_utf8_async(null, null);
      const match = stdout?.match(/gpu\s+(\d+(?:\.\d+)?)%/);
      return match ? Math.round(parseFloat(match[1])) : 0;
    } catch (e) {
      return 0;
    }
  }

  private _handleError(e: any): void {
    this._errorCount++;
    if (this._errorCount >= this._maxErrors) this._disabled = true;
  }
}
