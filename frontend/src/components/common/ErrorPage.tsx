import Logo from "./logo";
import HomeIcon from "./homeIcon";

export interface ErrorPageProps {
  errorMessage?: string;
  statusCode?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  errorMessage = "Something is wrong.",
  statusCode = "",
}) => {
  return (
    <div>
      <div className="pl-[10vw] flex flex-col gap-2 pt-2">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex min-h-screen flex-col items-center p-24 pt-0">
        <span className="p-24">
          <div className="flex flex-col items-center text-4xl font-bold">
            <h1 className="flex justify-center text-teal-600 p-5">
              Error {statusCode}
            </h1>
            <span className="font-normal text-2xl">{errorMessage}</span>
          </div>
        </span>
      </div>
    </div>
  );
};

export default ErrorPage;
