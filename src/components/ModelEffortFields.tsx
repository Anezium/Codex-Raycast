import { Form } from "@raycast/api";

import {
  EFFORT_OPTIONS,
  MODEL_OPTIONS,
  ReasoningEffort,
} from "../lib/preferences";

type Props = {
  defaultModel: string;
  defaultEffort: ReasoningEffort;
};

export function ModelEffortFields(props: Props) {
  return (
    <>
      <Form.Dropdown id="model" title="Model" defaultValue={props.defaultModel}>
        {MODEL_OPTIONS.map((model) => (
          <Form.Dropdown.Item
            key={model.value}
            title={model.title}
            value={model.value}
          />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        id="effort"
        title="Thinking Effort"
        defaultValue={props.defaultEffort}
      >
        {EFFORT_OPTIONS.map((effort) => (
          <Form.Dropdown.Item
            key={effort.value}
            title={effort.title}
            value={effort.value}
          />
        ))}
      </Form.Dropdown>
    </>
  );
}
