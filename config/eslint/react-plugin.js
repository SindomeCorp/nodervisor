function markJSXNameAsUsed(context, node) {
  if (!node) {
    return;
  }

  switch (node.type) {
    case 'JSXIdentifier':
      context.sourceCode.markVariableAsUsed(node.name);
      break;
    case 'JSXMemberExpression':
      markJSXNameAsUsed(context, node.object);
      break;
    case 'JSXNamespacedName':
      markJSXNameAsUsed(context, node.namespace);
      break;
    default:
      break;
  }
}

const jsxUsesVarsRule = {
  meta: {
    docs: {
      description: 'Marks variables used in JSX as used to support no-unused-vars.',
      recommended: true
    },
    schema: []
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        markJSXNameAsUsed(context, node.name);
      },
      JSXClosingElement(node) {
        markJSXNameAsUsed(context, node.name);
      },
      JSXAttribute(attribute) {
        if (attribute.value && attribute.value.type === 'JSXExpressionContainer') {
          const expression = attribute.value.expression;
          if (expression?.type === 'Identifier') {
            context.sourceCode.markVariableAsUsed(expression.name);
          }
        }
      }
    };
  }
};

const reactPlugin = {
  meta: {
    name: 'eslint-plugin-react-stub',
    version: '0.0.0'
  },
  configs: {
    recommended: {
      rules: {
        'react/jsx-uses-vars': 'error'
      }
    },
    'jsx-runtime': {
      rules: {}
    }
  },
  rules: {
    'jsx-uses-vars': jsxUsesVarsRule
  }
};

export default reactPlugin;
