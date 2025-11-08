pipeline {
  agent any

  environment {
    DOCKERHUB_CREDENTIALS = 'dockerhub-creds'   // Jenkins credentials id (username/token)
    DOCKERHUB_REPO = 'dhina2406/ci-node-sample' // change if needed
    SONAR_TOKEN = credentials('sonar-token')    // Jenkins secret credentials id for SonarCloud/SonarQube token
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        sh 'npm ci'
        sh 'npm test'
      }
    }

    stage('SonarQube Analysis') {
      steps {
        // This assumes you have Sonar Scanner available in Jenkins or configured as a tool.
        // We'll adapt the exact invocation later depending on SonarCloud vs local SonarQube.
        sh "sonar-scanner -Dsonar.projectKey=${env.JOB_NAME} -Dsonar.login=${SONAR_TOKEN}"
      }
    }

    stage('Docker Build') {
      steps {
        script {
          docker.build("${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}")
        }
      }
    }

    stage('Docker Push') {
      steps {
        script {
          docker.withRegistry('https://index.docker.io/v1/', env.DOCKERHUB_CREDENTIALS) {
            docker.image("${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}").push()
          }
        }
      }
    }

    stage('Deploy (local)') {
      steps {
        // This runs on the Jenkins agent which must have docker installed for this to work.
        sh "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
      }
    }
  }

  post {
    success {
      echo "Pipeline completed successfully!"
    }
    failure {
      echo "Pipeline failed!"
    }
  }
}
