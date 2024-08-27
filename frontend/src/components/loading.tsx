import ReactLoading from "react-loading";

export default function Loading() {
  return (
    <div className="flex flex-col items-center text-4xl font-bold">
      <h1 className="my-36">Loading...</h1>
      <ReactLoading
        type="spinningBubbles"
        color="#0000FF"
        height={300}
        width={150}
      />
    </div>
  );
}
