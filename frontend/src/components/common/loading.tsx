import ReactLoading from "react-loading";

export default function Loading({ message = "Loading..."}) {
  return (
    <div className="flex flex-col items-center text-4xl font-bold">
      <h1 className="my-36">{message}</h1>
      <ReactLoading
        type="spinningBubbles"
        color="#33a19a"
        height={300}
        width={150}
      />
    </div>
  );
}
