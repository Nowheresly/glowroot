import {Button} from "./components/Button.tsx";
import Header from "./components/Header.tsx";


function App() {
    return (
        <>
            <Header />
            <Button onClick={() => alert("hello")}>Button</Button>
        </>
    )
}

export default App
