import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button, EmptyState, Panel } from "../components/ui.tsx";

export default function NotFound() {
  return (
    <Panel>
      <EmptyState
        icon={<Compass size={24} />}
        title="This route is not on the academic map"
        description="The page may have moved, or the chapter id is invalid."
        action={
          <Link to="/">
            <Button variant="primary" size="sm">
              Return to command center
            </Button>
          </Link>
        }
      />
    </Panel>
  );
}
