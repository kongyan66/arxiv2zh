import hooks from "./hooks";
import type { TaskManager } from "./modules/taskManager";
import type { UIController } from "./modules/uiController";

class Addon {
  public data: {
    initialized: boolean;
    taskManager?: TaskManager;
    ui?: UIController;
  };
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      initialized: false,
    };
    this.hooks = hooks;
  }
}

export default Addon;
