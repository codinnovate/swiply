import { PostCard } from "./post-card";
import { reelPosts } from "./data";

export function PostReel() {
  const doubled = [...reelPosts, ...reelPosts];

  return (
    <div className="mt-16 overflow-hidden pb-2 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
      <div className="flex w-max animate-[swiply-marquee_46s_linear_infinite] gap-3.5 motion-reduce:animate-none">
        {doubled.map((post, i) => (
          <PostCard key={i} {...post} dark={post.platform === "Instagram"} />
        ))}
      </div>
    </div>
  );
}
