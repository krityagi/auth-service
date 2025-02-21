pipeline {
    agent any

    environment {
        PROJECT_ID = 'devopsduniya'
        REPOSITORY_NAME = 'auth-service'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        DOCKER_IMAGE = "gcr.io/${PROJECT_ID}/${REPOSITORY_NAME}:${IMAGE_TAG}"
    }

    stages {
        stage('Checkout Master Branch') {
            steps {
                script {
                    sh """
                    git checkout master
                    git pull origin master
                    """
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh 'docker build -t ${DOCKER_IMAGE} .'
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([file(credentialsId: 'gcr-service-account', variable: 'GCP_KEYFILE')]) {
                    script {
                        sh '''
                        gcloud auth activate-service-account --key-file=$GCP_KEYFILE
                        gcloud auth configure-docker
                        docker push ${DOCKER_IMAGE}
                        '''
                    }
                }
            }
        }

        stage('Test Docker Image') {
            steps {
                script {
                    sh '''
                    # Pull the image
                    docker pull ${DOCKER_IMAGE}
                    
                    # Run tests using the Docker image
                    docker run --rm ${DOCKER_IMAGE} npm test
                    '''
                }
            }
        }

        stage('Tag and Push') {
            steps {
                withCredentials([string(credentialsId: 'GitHub_Token', variable: 'GITHUB_TOKEN')]) {
                    script {
                        sh """
                        git tag ${env.BUILD_NUMBER}
                        git push https://krityagi:${GITHUB_TOKEN}@github.com/krityagi/auth-service.git ${env.BUILD_NUMBER}
                        """
                    }
                }
            }
        }

        stage('Trigger GitHub Actions') {
            steps {
                withCredentials([string(credentialsId: 'GitHub_Token', variable: 'GITHUB_TOKEN')]) {
                    script {
                        sh """
                        curl -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
                             -H "Accept: application/vnd.github.v3+json" \
                             -d '{"event_type":"jenkins_trigger", "client_payload": {"tag": "${env.BUILD_NUMBER}"}}' \
                             https://api.github.com/repos/krityagi/auth-service/dispatches
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
