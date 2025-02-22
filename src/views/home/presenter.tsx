import { message } from "ant-design-vue";
import { useRouter } from "vue-router";

import { useModel } from "./model";
import Service from "./service";

export const usePresenter = () => {
  const model = useModel();
  const service = new Service(model);

  const handleClick = () => {
    message.success("测试");
    //  测试 pinia
    service.saveCache();
    // 测试 mock
    service.mockTest();
  };

  const router = useRouter();
  router.replace("/xiaohongshu");

  return {
    model,
    service,
    handleClick,
  };
};
