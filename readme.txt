增加Browse 入口修改说明：
共新增4个文件，修改1 文件，

app/api/browse/list/route.ts	新增	Browse 列表 API
app/api/browse/types/route.ts	新增	Browse 类型 API
app/browse/layout.tsx	新增	BrowseLayout 组件
app/browse/page.tsx	新增	Browse 页面
components/layout/Navbar.tsx	修改	导航栏（接入 Browse 入口）

components/layout/Navbar.tsx修改插入位置：导航栏右侧按钮组的开头，<div className="flex items-center gap-2 sm:gap-3 flex-shrink-0"> 之后、IPTV 链接之前（Navbar.tsx 第 68~81 行附近）。
如果希望高级专区里也能分类浏览，把条件去掉或改成都显示即可：把 {!isPremiumMode && ( 到对应的 )} 这层包裹删掉，只留 <Link>...</Link> 那部分。

修改默认源：
// lib/api/default-sources.ts
export const DEFAULT_SOURCES: VideoSource[] = [];   // 普通默认源：空

// lib/api/premium-sources.ts
export const PREMIUM_SOURCES: VideoSource[] = [];   // 高级默认源：空
